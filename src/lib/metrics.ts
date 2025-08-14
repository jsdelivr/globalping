import _ from 'lodash';
import apmAgent from 'elastic-apm-node';
import type { Server as SocketServer } from 'socket.io';
import type { Knex } from 'knex';

import { scopedLogger } from './logger.js';
import { fetchProbes, getWsServer, PROBES_NAMESPACE } from './ws/server.js';
import { getMeasurementRedisClient, type RedisCluster } from './redis/measurement-client.js';
import { USERS_TABLE } from './http/auth.js';
import { client } from './sql/client.js';

const logger = scopedLogger('metrics');

export class MetricsAgent {
	private readonly counters: Record<string, number> = {};
	private readonly statsAvg: Record<string, number[]> = {};
	private readonly statsMed: Record<string, number[]> = {};
	private readonly statsMax: Record<string, number[]> = {};
	private readonly asyncSeries: Record<string, number[]> = {};
	private readonly timers: Record<string, NodeJS.Timeout> = {};

	constructor (
		private readonly io: SocketServer,
		private readonly redis: RedisCluster,
		private readonly sql: Knex,
	) {}

	run (): void {
		this.registerAsyncCollector(`gp.measurement.stored.count`, async () => {
			const [ dbSize, awaitingSize ] = await Promise.all([
				this.redis.reduceMasters<number>(async (accumulator, client) => accumulator + await client.dbSize(), 0),
				this.redis.hLen('gp:in-progress'),
			]);

			// running measurements use 3 keys
			// finished measurements use 2 keys
			// 1 global key tracks the in-progress measurements
			return Math.round((dbSize - awaitingSize - 1) / 2);
		}, 60 * 1000);

		this.registerAsyncCollector(`gp.probe.count.local`, async () => {
			return this.io.of(PROBES_NAMESPACE).local.fetchSockets().then(sockets => sockets.length);
		}, 10 * 1000);

		this.registerAsyncGroupCollector('global probe stats', async () => {
			const probes = await fetchProbes();
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
	}

	recordMeasurementTime (type: string, time: number): void {
		this.recordStats(`gp.measurement.time.${type}`, time);
	}

	recordMeasurement (type: string, probeCount: number): void {
		this.incrementCounter(`gp.measurement.count.${type}`);
		this.incrementCounter('gp.measurement.count.total');
		this.incrementCounter(`gp.test.count.${type}`, probeCount);
		this.incrementCounter('gp.test.count.total', probeCount);
	}

	recordDisconnect (type: string): void {
		this.incrementCounter(`gp.probe.disconnect_${type.replaceAll(' ', '_')}`);
	}

	private incrementCounter (name: string, value: number = 1): void {
		if (!this.counters[name]) {
			this.registerCounter(name);
		}

		this.counters[name]! += value;
	}

	private registerCounter (name: string): void {
		this.counters[name] = 0;

		registerGuardedMetric(name, () => {
			const value = this.counters[name];
			this.counters[name] = 0;
			return value;
		});
	}

	private recordStats (name: string, value: number): void {
		if (!this.statsAvg[name]) {
			this.registerStats(name);
		}

		this.statsAvg[name]!.push(value);
		this.statsMed[name]!.push(value);
		this.statsMax[name]!.push(value);
	}

	private registerStats (name: string): void {
		this.statsAvg[name] = [];
		this.statsMed[name] = [];
		this.statsMax[name] = [];

		registerGuardedMetric(`${name}.avg`, () => {
			const value = _.mean(this.statsAvg[name]);
			this.statsAvg[name] = [];
			return value;
		});

		registerGuardedMetric(`${name}.median`, () => {
			const value = median(this.statsMed[name]!);
			this.statsMed[name] = [];
			return value;
		});

		registerGuardedMetric(`${name}.max`, () => {
			const value = _.max(this.statsMax[name]);
			this.statsMax[name] = [];
			return value;
		});
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

let agent: MetricsAgent;

export const getMetricsAgent = () => {
	if (!agent) {
		agent = new MetricsAgent(getWsServer(), getMeasurementRedisClient(), client);
	}

	return agent;
};

export const captureSpan = <R>(name: string, fn: () => R): R => {
	const span = apmAgent.startSpan(name);
	const result = fn();

	void Promise.resolve(result).finally(() => {
		span?.end();
	});

	return result;
};

function median (values: number[]): number | undefined {
	values.sort((a, b) => a - b);
	const half = Math.floor(values.length / 2);

	if (values.length % 2) {
		return values[half];
	}

	return (values[half - 1]! + values[half]!) / 2;
}

function registerGuardedMetric (name: string, callback: () => number | undefined): void {
	apmAgent.registerMetric(name, () => {
		const value = callback();
		return value || 0; // NaN/undefined => 0
	});
}
