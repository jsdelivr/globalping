import config from 'config';
import type { Server } from 'socket.io';
import createHttpError from 'http-errors';
import apmAgent from 'elastic-apm-node';
import { getWsServer, PROBES_NAMESPACE } from '../lib/ws/server.js';
import { getProbeRouter, type ProbeRouter } from '../probe/router.js';
import type { ServerProbe } from '../probe/types.js';
import { getMetricsAgent, type MetricsAgent } from '../lib/metrics.js';
import type { MeasurementStore } from './store.js';
import { getMeasurementStore } from './store.js';
import type { MeasurementRequest, MeasurementResultMessage, MeasurementProgressMessage, UserRequest, MeasurementRequestMessage } from './types.js';
import { checkPostMeasurementRateLimit } from '../lib/rate-limiter/rate-limiter-post.js';
import type { ExtendedContext } from '../types.js';

export class MeasurementRunner {
	constructor (
		private readonly io: Server,
		private readonly store: MeasurementStore,
		private readonly router: ProbeRouter,
		private readonly checkRateLimit: typeof checkPostMeasurementRateLimit,
		private readonly metrics: MetricsAgent,
	) {}

	async run (ctx: ExtendedContext): Promise<{ measurementId: string; probesCount: number }> {
		const userRequest = ctx.request.body as UserRequest;
		const { onlineProbesMap, allProbes, request } = await this.router.findMatchingProbes(userRequest);
		const ipVersion = userRequest.measurementOptions?.ipVersion;

		if (allProbes.length === 0) {
			throw createHttpError(422, `No matching IPv${ipVersion} probes available.`, { type: 'no_probes_found' });
		}

		await this.checkRateLimit(ctx, onlineProbesMap.size);

		const measurementId = await this.store.createMeasurement(request, onlineProbesMap, allProbes);
		apmAgent.addLabels({ gpMeasurementId: measurementId, gpMeasurementType: request.type, gpMeasurementTarget: request.target, gpMeasurementProbes: onlineProbesMap.size }, false);

		if (onlineProbesMap.size) {
			this.sendToProbes(measurementId, onlineProbesMap, request);
			// If all selected probes are offline, immediately mark the measurement as finished
		} else {
			await this.store.markFinished(measurementId);
		}

		this.metrics.recordMeasurement(request.type, onlineProbesMap.size);

		return { measurementId, probesCount: allProbes.length };
	}

	async recordProgress (data: MeasurementProgressMessage): Promise<void> {
		await this.store.storeMeasurementProgress(data);
	}

	async recordResult (data: MeasurementResultMessage): Promise<void> {
		const record = await this.store.storeMeasurementResult(data);

		if (record) {
			this.metrics.recordMeasurementTime(record.type, Date.now() - new Date(record.createdAt).getTime());
		}
	}

	private sendToProbes (measurementId: string, onlineProbesMap: Map<number, ServerProbe>, request: MeasurementRequest) {
		let inProgressTests = 0;
		const maxInProgressTests = config.get<number>('measurement.maxInProgressTests');
		onlineProbesMap.forEach((probe, index) => {
			const inProgressUpdates = request.inProgressUpdates && inProgressTests++ < maxInProgressTests;
			const requestMessage: MeasurementRequestMessage = {
				measurementId,
				testId: index.toString(),
				measurement: {
					...request.measurementOptions,
					type: request.type,
					target: request.target,
					inProgressUpdates,
				},
			};
			this.io.of(PROBES_NAMESPACE).to(probe.client).emit('probe:measurement:request', requestMessage);
		});
	}
}

// Factory

let runner: MeasurementRunner;

export const getMeasurementRunner = () => {
	if (!runner) {
		runner = new MeasurementRunner(getWsServer(), getMeasurementStore(), getProbeRouter(), checkPostMeasurementRateLimit, getMetricsAgent());
	}

	return runner;
};
