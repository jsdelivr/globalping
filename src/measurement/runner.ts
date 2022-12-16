import config from 'config';
import type {Server} from 'socket.io';
import createHttpError from 'http-errors';
import {scopedLogger} from '../lib/logger.js';
import {getWsServer} from '../lib/ws/server.js';
import type {RedisClient} from '../lib/redis/client.js';
import {getRedisClient} from '../lib/redis/client.js';
import {getProbeRouter, ProbeRouter} from '../probe/router.js';
import type {Probe} from '../probe/types.js';
import {getMetricsAgent, MetricsAgent} from '../lib/metrics.js';
import type {MeasurementStore} from './store.js';
import {getMeasurementKey, getMeasurementStore} from './store.js';
import type {
	NetworkTest,
	MeasurementConfig,
	MeasurementRequest,
	MeasurementResultMessage,
	MeasurementRecord,
} from './types.js';

const logger = scopedLogger('measurement');

export class MeasurementRunner {
	private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

	constructor(
		private readonly io: Server,
		private readonly redis: RedisClient,
		private readonly store: MeasurementStore,
		private readonly router: ProbeRouter,
		private readonly metrics: MetricsAgent,
	) {}

	async run(request: MeasurementRequest): Promise<MeasurementConfig> {
		const probes = await this.router.findMatchingProbes(request.locations, request.limit);

		if (probes.length === 0) {
			throw createHttpError(422, 'No suitable probes found', {type: 'no_probes_found'});
		}

		const measurement: NetworkTest = {
			...request.measurementOptions,
			type: request.type,
			target: request.target,
		};

		const id = await this.store.createMeasurement(measurement, probes.length);
		const measurementConfig: MeasurementConfig = {id, probes, measurementOptions: measurement};

		this.sendToProbes(measurementConfig);
		this.setTimeout(measurementConfig.id);
		this.metrics.recordMeasurement(request.type);

		return measurementConfig;
	}

	async addProbe(measurementId: string, resultId: string, probe: Probe): Promise<void> {
		await this.store.storeMeasurementProbe(measurementId, resultId, probe);
	}

	async recordProgress(data: MeasurementResultMessage): Promise<void> {
		await this.store.storeMeasurementProgress(data);
	}

	async recordResult(data: MeasurementResultMessage): Promise<void> {
		const probesAwaiting = await this.redis.get(getMeasurementKey(data.measurementId, 'probes_awaiting'));

		if (probesAwaiting === null) {
			return;
		}

		const remainingProbes = await this.store.storeMeasurementResult(data);

		if (remainingProbes === 0) {
			await this.store.markFinished(data.measurementId);
			this.clearTimeout(data.measurementId);
			const record = (await this.redis.json.get(getMeasurementKey(data.measurementId))) as MeasurementRecord;
			if (record) {
				this.metrics.recordMeasurementTime(record.type, (Date.now() - (new Date(record.createdAt)).getTime()));
			}
		}
	}

	private sendToProbes(measurementConfig: MeasurementConfig) {
		for (const probe of measurementConfig.probes) {
			this.io.of('probes').to(probe.client).emit('probe:measurement:request', {
				id: measurementConfig.id,
				measurement: measurementConfig.measurementOptions,
			});
		}
	}

	private setTimeout(id: string): void {
		const timeout = config.get<number>('measurement.timeout') * 1000;

		const timer = setTimeout(() => {
			this.timers.delete(id);
			this.store.markFinished(id).catch(error => logger.error(error));
		}, timeout);

		this.timers.set(id, timer);
	}

	private clearTimeout(id: string): void {
		const timer = this.timers.get(id);

		if (timer) {
			this.timers.delete(id);
			clearTimeout(timer);
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
