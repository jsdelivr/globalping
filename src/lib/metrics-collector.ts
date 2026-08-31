import _ from 'lodash';
import { Queue as BullQueue } from 'bullmq';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import type { Knex } from 'knex';
import type { Pool } from 'tarn';

import { scopedLogger } from './logger.js';
import { getMeasurementRedisClient, type RedisCluster } from './redis/measurement-client.js';
import { USERS_TABLE } from './http/auth.js';
import { dashboardClient } from './sql/client.js';
import type { IoContext } from './server.js';
import { registerGuardedMetric } from './metrics.js';
import { getMeasurementStoreFallbackQueueConnectionOptions, MEASUREMENT_STORE_FALLBACK_QUEUE_NAME } from '../measurement/store-offloader.js';

const logger = scopedLogger('metrics');
const eventLoopMonitorResolution = 10;
const measurementOffloadPendingStates = [ 'waiting', 'active', 'delayed', 'paused' ] as const;

export class MetricsCollector {
	private readonly asyncSeries: Record<string, number[]> = {};
	private readonly timers: Record<string, NodeJS.Timeout> = {};

	constructor (
		private readonly fetchRawLocalSockets: IoContext['fetchRawLocalSockets'],
		private readonly redis: RedisCluster,
		private readonly sql: Knex,
		private readonly fetchProbes: IoContext['fetchProbes'],
		private readonly measurementOffloadQueue: BullQueue,
	) {}

	run (): void {
		const loopMonitorP95 = monitorEventLoopDelay({ resolution: eventLoopMonitorResolution });
		const loopMonitorP99 = monitorEventLoopDelay({ resolution: eventLoopMonitorResolution });
		const loopMonitorMax = monitorEventLoopDelay({ resolution: eventLoopMonitorResolution });
		loopMonitorP95.enable();
		loopMonitorP99.enable();
		loopMonitorMax.enable();

		const toMs = (value: number) => Math.max(0, Number(value) / 1e6 - eventLoopMonitorResolution);

		registerGuardedMetric('nodejs.eventloop.delay.p95.ms', () => {
			const loopDelay = toMs(loopMonitorP95.percentile(95));
			loopMonitorP95.reset();
			return loopDelay;
		});

		registerGuardedMetric('nodejs.eventloop.delay.p99.ms', () => {
			const loopDelay = toMs(loopMonitorP99.percentile(99));
			loopMonitorP99.reset();
			return loopDelay;
		});

		registerGuardedMetric('nodejs.eventloop.delay.max.ms', () => {
			const loopDelay = toMs(loopMonitorMax.max);
			loopMonitorMax.reset();
			return loopDelay;
		});

		this.registerAsyncCollector(`gp.measurement.stored.count`, async () => {
			const [ dbSize, awaitingSize ] = await Promise.all([
				this.redis.reduceMasters<number>(async (accumulator, client) => accumulator + await client.dbSize(), 0),
				this.redis.zCard('gp:in-progress-timeouts'),
			]);

			// running measurements use 3 keys
			// finished measurements use 2 keys
			// 1 global key tracks the in-progress measurements
			return Math.round((dbSize - awaitingSize - 1) / 2);
		}, 60 * 1000);

		this.registerAsyncGroupCollector('measurement cleanup stats', async () => {
			const now = Date.now();
			const [ inProgressCount, pendingCleanupCount ] = await Promise.all([
				this.redis.zCard('gp:in-progress-timeouts'),
				this.redis.zCount('gp:in-progress-timeouts', '-inf', now),
			]);

			return {
				'gp.measurement.in_progress.count': inProgressCount,
				'gp.measurement.cleanup.pending.count': pendingCleanupCount,
			};
		}, 10 * 1000);

		this.registerAsyncGroupCollector('measurement offload stats', async () => {
			const counts = await this.measurementOffloadQueue.getJobCounts(...measurementOffloadPendingStates);

			return {
				'gp.measurement.offload.pending.count': _.sum(Object.values(counts)),
			};
		}, 10 * 1000);

		this.registerAsyncCollector(`gp.probe.count.local`, async () => {
			return this.fetchRawLocalSockets().then(sockets => sockets.length);
		}, 10 * 1000);

		this.registerAsyncGroupCollector('global probe stats', async () => {
			const probes = await this.fetchProbes();
			const byContinent = _.groupBy(probes, probe => probe.location.continent);

			const countByContinent = _(byContinent)
				.mapKeys((_probes, continent) => `gp.probe.count.continent.${continent}`)
				.mapValues(probes => probes.length)
				.value();

			return {
				...countByContinent,
				'gp.probe.count.adopted': probes.filter(probe => probe.owner).length,
				'gp.probe.count.total': probes.length,
			};
		}, 10 * 1000);

		this.registerAsyncGroupCollector(`user stats`, async () => {
			const result = await this.sql(USERS_TABLE)
				.count('user_type as c')
				.groupBy('user_type')
				.select<{ user_type: string; c: number }[]>([ 'user_type' ]);

			const countByType = _(result)
				.mapKeys(record => `gp.user.count.${record.user_type}`)
				.mapValues(record => record.c)
				.value();

			return {
				...countByType,
				'gp.user.count.total': _.sum(Object.values(countByType)),
			};
		}, 60 * 1000);

		const getDashboardPool = (): Pool<unknown> | undefined => {
			return (this.sql.client as Knex.Client).pool as Pool<unknown> | undefined;
		};

		registerGuardedMetric('gp.db.dashboard.pool.used', () => getDashboardPool()?.numUsed());
		registerGuardedMetric('gp.db.dashboard.pool.pending_acquires', () => getDashboardPool()?.numPendingAcquires());
	}

	private recordAsyncDatapoint (name: string, value: number): void {
		if (!this.asyncSeries[name]) {
			this.registerAsyncSeries(name);
		}

		this.asyncSeries[name]!.push(value);
	}

	private registerAsyncSeries (name: string): void {
		this.asyncSeries[name] = [];

		registerGuardedMetric(name, () => {
			const value = this.asyncSeries[name]!.at(-1);
			this.asyncSeries[name] = [];
			return value;
		});
	}

	private registerAsyncCollector (name: string, callback: () => Promise<number>, interval: number): void {
		this.timers[name] = setInterval(() => {
			callback().then((value) => {
				this.recordAsyncDatapoint(name, value);
			}).catch((error) => {
				logger.error(`Failed to collect an async metric "${name}"`, error);
			});
		}, interval);
	}

	private registerAsyncGroupCollector (groupName: string, callback: () => Promise<{ [k: string]: number }>, interval: number): void {
		this.timers[groupName] = setInterval(() => {
			callback().then((group) => {
				Object.entries(group).forEach(([ key, value ]) => {
					this.recordAsyncDatapoint(key, value);
				});
			}).catch((error) => {
				logger.error(`Failed to collect an async metric group "${groupName}"`, error);
			});
		}, interval);
	}
}

export const initMetricsCollector = (fetchRawLocalSockets: IoContext['fetchRawLocalSockets'], fetchProbes: IoContext['fetchProbes']) => {
	const measurementOffloadQueue = new BullQueue(MEASUREMENT_STORE_FALLBACK_QUEUE_NAME, {
		connection: getMeasurementStoreFallbackQueueConnectionOptions(),
	});

	return new MetricsCollector(fetchRawLocalSockets, getMeasurementRedisClient(), dashboardClient, fetchProbes, measurementOffloadQueue);
};
