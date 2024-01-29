import config from 'config';
import type { Server } from 'socket.io';
import createHttpError from 'http-errors';
import { getWsServer } from '../lib/ws/server.js';
import { getProbeRouter, type ProbeRouter } from '../probe/router.js';
import type { Probe } from '../probe/types.js';
import { getMetricsAgent, type MetricsAgent } from '../lib/metrics.js';
import type { MeasurementStore } from './store.js';
import { getMeasurementStore } from './store.js';
import type { MeasurementRequest, MeasurementResultMessage, MeasurementProgressMessage, UserRequest } from './types.js';
import { rateLimit } from '../lib/rate-limiter.js';
import type { ExtendedContext } from '../types.js';

export class MeasurementRunner {
	constructor (
		private readonly io: Server,
		private readonly store: MeasurementStore,
		private readonly router: ProbeRouter,
		private readonly checkRateLimit: typeof rateLimit,
		private readonly metrics: MetricsAgent,
	) {}

	async run (ctx: ExtendedContext): Promise<{measurementId: string; probesCount: number;}> {
		const userRequest = ctx.request.body as UserRequest;
		const { onlineProbesMap, allProbes, request } = await this.router.findMatchingProbes(userRequest);

		if (allProbes.length === 0) {
			throw createHttpError(422, 'No suitable probes found.', { type: 'no_probes_found' });
		}

		await this.checkRateLimit(ctx, onlineProbesMap.size);

		const measurementId = await this.store.createMeasurement(request, onlineProbesMap, allProbes);

		if (onlineProbesMap.size) {
			this.sendToProbes(measurementId, onlineProbesMap, request);
			// If all selected probes are offline, immediately mark measurement as finished
		} else {
			await this.store.markFinished(measurementId);
		}

		this.metrics.recordMeasurement(request.type);

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

	private sendToProbes (measurementId: string, onlineProbesMap: Map<number, Probe>, request: MeasurementRequest) {
		let inProgressProbes = 0;
		const maxInProgressProbes = config.get<number>('measurement.maxInProgressProbes');
		onlineProbesMap.forEach((probe, index) => {
			const inProgressUpdates = request.inProgressUpdates && inProgressProbes++ < maxInProgressProbes;
			this.io.of('probes').to(probe.client).emit('probe:measurement:request', {
				measurementId,
				testId: index.toString(),
				measurement: {
					...request.measurementOptions,
					type: request.type,
					target: request.target,
					inProgressUpdates,
				},
			});
		});
	}
}

// Factory

let runner: MeasurementRunner;

export const getMeasurementRunner = () => {
	if (!runner) {
		runner = new MeasurementRunner(getWsServer(), getMeasurementStore(), getProbeRouter(), rateLimit, getMetricsAgent());
	}

	return runner;
};
