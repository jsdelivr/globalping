import type {Server} from 'socket.io';
import type {RedisClient} from '../lib/redis/client.js';
import {getRedisClient} from '../lib/redis/client.js';
import {getWsServer} from '../lib/ws/server.js';
import {getProbeRouter, ProbeRouter} from '../probe/router.js';
import {scopedLogger} from '../lib/logger.js';
import type {Probe} from '../probe/types.js';
import type {MeasurementStore} from './store.js';
import type {MeasurementConfig, MeasurementRequest, MeasurementResultMessage} from './types.js';
import {getMeasurementKey, getMeasurementStore} from './store.js';

const logger = scopedLogger('measurement');

export class MeasurementRunner {
	private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

	constructor(
		private readonly io: Server,
		private readonly redis: RedisClient,
		private readonly store: MeasurementStore,
		private readonly router: ProbeRouter,
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
		const timer = setTimeout(() => {
			this.timers.delete(id);
			this.store.markFinished(id).catch(error => logger.error(error));
		}, 30_000);

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
		runner = new MeasurementRunner(getWsServer(), getRedisClient(), getMeasurementStore(), getProbeRouter());
	}

	return runner;
};
