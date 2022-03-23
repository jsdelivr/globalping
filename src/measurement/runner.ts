import config from 'config';
import type {Server} from 'socket.io';
import {scopedLogger} from '../lib/logger.js';
import {getWsServer} from '../lib/ws/server.js';
import type {RedisClient} from '../lib/redis/client.js';
import {getRedisClient} from '../lib/redis/client.js';
import {getProbeRouter, ProbeRouter} from '../probe/router.js';
import type {Probe} from '../probe/types.js';
import {getMetricsAgent, MetricsAgent} from '../lib/metrics.js';
import type {MeasurementStore} from './store.js';
import {getMeasurementKey, getMeasurementStore} from './store.js';
import type {MeasurementConfig, MeasurementRequest, MeasurementResultMessage, MeasurementRecord} from './types.js';

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
			throw new Error('no suitable probes');
		}

		const id = await this.store.createMeasurement(request.measurement, probes.length);
		const config: MeasurementConfig = {id, probes, measurement: request.measurement};

		this.sendToProbes(config);
		this.setTimeout(config.id);
		this.metrics.recordMeasurement(request.measurement.type);

		return config;
	}

	async addProbe(measurementId: string, resultId: string, probe: Probe): Promise<void> {
		await this.store.storeMeasurementProbe(measurementId, resultId, probe);
	}

	async recordProgress(data: MeasurementResultMessage): Promise<void> {
		await this.store.storeMeasurementProgress(data);
	}

	async recordResult(data: MeasurementResultMessage): Promise<void> {
		await this.store.storeMeasurementResult(data);
		const probesAwaiting = await this.redis.get(getMeasurementKey(data.measurementId, 'probes_awaiting'));

		if (probesAwaiting !== null && Number(probesAwaiting) > 0) {
			return;
		}

		await this.store.markFinished(data.measurementId);
		this.clearTimeout(data.measurementId);

		const record = (await this.redis.json.get(getMeasurementKey(data.measurementId))) as MeasurementRecord;
		if (record) {
			this.metrics.recordMeasurementTime(record.type, (Date.now() - (new Date(record.createdAt)).getTime()));
		}
	}

	private sendToProbes(config: MeasurementConfig) {
		for (const probe of config.probes) {
			this.io.of('probes').to(probe.client).emit('probe:measurement:request', {
				id: config.id,
				measurement: config.measurement,
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
