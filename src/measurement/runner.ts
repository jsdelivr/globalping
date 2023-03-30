import type { Server } from 'socket.io';
import createHttpError from 'http-errors';
import cryptoRandomString from 'crypto-random-string';
import { getWsServer } from '../lib/ws/server.js';
import type { RedisClient } from '../lib/redis/client.js';
import { getRedisClient } from '../lib/redis/client.js';
import { getProbeRouter, type ProbeRouter } from '../probe/router.js';
import type { Probe } from '../probe/types.js';
import { getMetricsAgent, type MetricsAgent } from '../lib/metrics.js';
import type { MeasurementStore } from './store.js';
import { getMeasurementKey, getMeasurementStore } from './store.js';
import type {
	NetworkTest,
	MeasurementConfig,
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
		const probesArray = await this.router.findMatchingProbes(request.locations, request.limit);
		const probesCount = probesArray.length;

		if (probesCount === 0) {
			throw createHttpError(422, 'No suitable probes found', { type: 'no_probes_found' });
		}

		const probes: Record<string, Probe> = {};
		probesArray.forEach((probe) => {
			const testId = cryptoRandomString({ length: 16, type: 'alphanumeric' });
			probes[testId] = probe;
		});

		const measurement: NetworkTest = {
			...request.measurementOptions,
			type: request.type,
			target: request.target,
		};

		const measurementId = await this.store.createMeasurement(measurement, probes, probesCount);

		this.sendToProbes({ measurementId, probes, measurementOptions: measurement });
		this.metrics.recordMeasurement(request.type);

		return { measurementId, probesCount };
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

	private sendToProbes (measurementConfig: MeasurementConfig) {
		for (const [ testId, probe ] of Object.entries(measurementConfig.probes)) {
			this.io.of('probes').to(probe.client).emit('probe:measurement:request', {
				measurementId: measurementConfig.measurementId,
				testId,
				measurement: measurementConfig.measurementOptions,
			});
		}
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
