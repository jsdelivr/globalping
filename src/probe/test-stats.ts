import config from 'config';
import _ from 'lodash';
import { scopedLogger } from '../lib/logger.js';
import { metricsAgent } from '../lib/metrics.js';
import { getPersistentNoEvictionRedisClient, type RedisClient } from '../lib/redis/persistent-no-eviction-client.js';
import { parseMeasurementId } from '../measurement/id.js';
import type { FailureSource, RequestType, TestResult } from '../measurement/types.js';
import type { ServerProbe } from './types.js';
import { createEmptyCounters, getProbeTestStatsStorage, type ProbeTestCounter, type ProbeTestStatsRow, type ProbeTestStatsStorage } from './test-stats-storage.js';

const logger = scopedLogger('probe-test-stats');

const HOUR = 60 * 60 * 1000;
const MAX_MEASUREMENT_DURATION = (config.get<number>('measurement.timeout') + 5) * 1000;
const SETTLE_DELAY = 60 * 1000;
const MAX_FLUSH_INTERVAL = 60 * 1000;
const FLUSH_LEASE_TIME = 30 * 1000;
const ERROR_LOG_INTERVAL = 60 * 1000;

const KEY_PREFIX = 'gp:probe-test-stats:{probe-test-stats}';
const BUCKETS_KEY = `${KEY_PREFIX}:buckets`;

type ProbeTestOutcome = Exclude<ProbeTestCounter, 'assigned'>;

const FAILURE_SOURCE_OUTCOMES: Record<FailureSource, ProbeTestOutcome> = {
	target: 'failedTarget',
	resolver: 'failedResolver',
	internal: 'failedInternal',
};

const getProbeTestOutcome = (result: Pick<TestResult, 'status' | 'failureSource'>): ProbeTestOutcome => {
	return result.status === 'finished' ? 'finished' : FAILURE_SOURCE_OUTCOMES[result.failureSource ?? 'internal'];
};

const getBucketKeys = (hour: number) => {
	const prefix = `${KEY_PREFIX}:${hour}`;
	return { pending: `${prefix}:pending`, counters: `${prefix}:counters`, lease: `${prefix}:lease` };
};

const getBucketHour = (measurementId: string) => {
	const { minutesSinceEpoch } = parseMeasurementId(measurementId);
	return Math.floor(minutesSinceEpoch / 60) * HOUR;
};

const getTestKey = (measurementId: string, testId: string | number) => `${measurementId}_${testId}`;

export class ProbeTestStats {
	private readonly logError = _.throttle((operation: string, error: unknown) => logger.error(`Probe test stats ${operation} operation failed.`, error), ERROR_LOG_INTERVAL, { trailing: false });

	constructor (
		private readonly redis: RedisClient,
		private readonly storage: ProbeTestStatsStorage,
	) {}

	recordAssignments (measurementId: string, type: RequestType, probes: Map<number, ServerProbe>): void {
		if (probes.size === 0) {
			return;
		}

		const hour = getBucketHour(measurementId);
		const { pending, counters } = getBucketKeys(hour);
		const tests = Array.from(probes, ([ testId, probe ]) => ({ testKey: getTestKey(measurementId, testId), base: `${probe.uuid}:${type}` }));

		this.redis.recordProbeTestAssignments(pending, counters, BUCKETS_KEY, hour, tests)
			.catch(error => this.onError('assignment', error));
	}

	recordResult (measurementId: string, testId: string, result: Pick<TestResult, 'status' | 'failureSource'>): void {
		const { pending, counters } = getBucketKeys(getBucketHour(measurementId));

		this.redis.settleProbeTests(pending, counters, getProbeTestOutcome(result), [ getTestKey(measurementId, testId) ])
			.catch(error => this.onError('result', error));
	}

	recordTimeouts (measurementId: string, testIds: number[]): void {
		if (testIds.length === 0) {
			return;
		}

		const { pending, counters } = getBucketKeys(getBucketHour(measurementId));

		this.redis.settleProbeTests(pending, counters, 'timedOut', testIds.map(testId => getTestKey(measurementId, testId)))
			.catch(error => this.onError('timeout', error));
	}

	async getFlushBacklog (): Promise<{ count: number; oldestAge: number }> {
		const now = Date.now();
		const hours = await this.getClosedBuckets(now);

		return {
			count: hours.length,
			oldestAge: hours.length ? now - hours[0]! - HOUR : 0,
		};
	}

	async flush (): Promise<void> {
		for (const hour of await this.getClosedBuckets()) {
			await this.flushBucket(hour);
		}
	}

	scheduleFlush () {
		setTimeout(() => {
			this.flush()
				.finally(() => this.scheduleFlush())
				.catch((error) => {
					logger.error('Failed to persist probe test stats.', error);
					metricsAgent.recordProbeTestStatsError('flush');
				});
		}, Math.round(Math.random() * MAX_FLUSH_INTERVAL)).unref();
	}

	private async getClosedBuckets (now = Date.now()): Promise<number[]> {
		const hours = await this.redis.zRangeByScore(BUCKETS_KEY, 0, now - HOUR - MAX_MEASUREMENT_DURATION - SETTLE_DELAY);
		return hours.map(Number);
	}

	private async flushBucket (hour: number): Promise<void> {
		const { pending, counters, lease } = getBucketKeys(hour);
		const now = Date.now();
		const values = await this.redis.claimProbeTestStats(pending, counters, lease, now, now + FLUSH_LEASE_TIME);

		if (!values) {
			return;
		}

		await this.storage.writeHourly(this.toRows(hour, values));
		await this.redis.multi().unlink([ pending, counters, lease ]).zRem(BUCKETS_KEY, hour.toString()).exec();
	}

	private toRows (hour: number, values: Record<string, string>): ProbeTestStatsRow[] {
		const rows: Record<string, ProbeTestStatsRow> = {};

		for (const [ field, value ] of Object.entries(values)) {
			const [ probeUuid, testType, counter ] = field.split(':') as [ string, RequestType, ProbeTestCounter ];
			const row = rows[`${probeUuid}:${testType}`] ??= { probeUuid, hour: new Date(hour), testType, ...createEmptyCounters() };
			row[counter] = Number(value);
		}

		return Object.values(rows);
	}

	private onError (operation: 'assignment' | 'result' | 'timeout', error: unknown) {
		metricsAgent.recordProbeTestStatsError(operation);
		this.logError(operation, error);
	}
}

let probeTestStats: ProbeTestStats;

export const getProbeTestStats = () => {
	if (!probeTestStats) {
		probeTestStats = new ProbeTestStats(getPersistentNoEvictionRedisClient(), getProbeTestStatsStorage());
	}

	return probeTestStats;
};
