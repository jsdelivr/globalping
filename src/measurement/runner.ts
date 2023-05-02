import config from 'config';
import type { Server } from 'socket.io';
import createHttpError from 'http-errors';
import { getWsServer } from '../lib/ws/server.js';
import type { RedisClient } from '../lib/redis/client.js';
import { getRedisClient } from '../lib/redis/client.js';
import { getProbeRouter, type ProbeRouter } from '../probe/router.js';
import type { Probe } from '../probe/types.js';
import { getMetricsAgent, type MetricsAgent } from '../lib/metrics.js';
import type { MeasurementStore } from './store.js';
import { getMeasurementKey, getMeasurementStore } from './store.js';
import type {
	MeasurementRequest,
	MeasurementResultMessage,
	MeasurementRecord,
} from './types.js';

export class MeasurementRunner {
	constructor (
		private readonly io: Server,
		private readonly redis: RedisClient,
		private readonly store: MeasurementStore,
		private readonly router: ProbeRouter,
		private readonly metrics: MetricsAgent,
	) {}

	async run (request: MeasurementRequest): Promise<{measurementId: string; probesCount: number;}> {
		const probes = await this.router.findMatchingProbes(request.locations, request.limit);

		if (probes.length === 0) {
			throw createHttpError(422, 'No suitable probes found', { type: 'no_probes_found' });
		}

		const measurementId = await this.store.createMeasurement(request, probes);

		this.sendToProbes(measurementId, probes, request);
		this.metrics.recordMeasurement(request.type);

		return { measurementId, probesCount: probes.length };
	}

	async recordProgress (data: MeasurementResultMessage): Promise<void> {
		await this.store.storeMeasurementProgress(data);
	}

	async recordResult (data: MeasurementResultMessage): Promise<void> {
		const probesAwaiting = await this.redis.get(getMeasurementKey(data.measurementId, 'probes_awaiting'));

		if (probesAwaiting === null) {
			return;
		}

		const remainingProbes = await this.store.storeMeasurementResult(data);

		if (remainingProbes === 0) {
			await this.store.markFinished(data.measurementId);
			const record = (await this.redis.json.get(getMeasurementKey(data.measurementId))) as MeasurementRecord;

			if (record) {
				this.metrics.recordMeasurementTime(record.type, Date.now() - new Date(record.createdAt).getTime());
			}
		}
	}

	private sendToProbes (measurementId: string, probes: Probe[], request: MeasurementRequest) {
		let inProgressProbes = 0;
		const maxInProgressProbes = config.get<number>('measurement.maxInProgressProbes');
		probes.forEach((probe, index) => {
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
		runner = new MeasurementRunner(getWsServer(), getRedisClient(), getMeasurementStore(), getProbeRouter(), getMetricsAgent());
	}

	return runner;
};
