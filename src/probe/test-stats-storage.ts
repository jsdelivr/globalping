import _ from 'lodash';
import type { Knex } from 'knex';
import { timeSeriesClient } from '../lib/sql/client.js';
import type { RequestType } from '../measurement/types.js';

const PROBE_TEST_TYPES: RequestType[] = [ 'ping', 'traceroute', 'dns', 'http', 'mtr' ];
const PROBE_TEST_COUNTERS = [ 'assigned', 'finished', 'failedTarget', 'failedResolver', 'failedInternal', 'timedOut' ] as const;

export type ProbeTestCounter = typeof PROBE_TEST_COUNTERS[number];
type ProbeTestCounters = Record<ProbeTestCounter, number>;

export type ProbeTestStatsRow = ProbeTestCounters & {
	probeUuid: string;
	hour: Date;
	testType: RequestType;
};

export type ProbeTestStatsRange = {
	from: Date;
	to: Date;
	interval: 'hour' | 'day';
};

type ProbeTestStatsBucket = {
	timestamp: Date;
	tests: Record<RequestType, ProbeTestCounters>;
};

type ReadRow = { timestamp: Date; testType: RequestType } & Record<ProbeTestCounter, string>;

const TABLE = 'probe_test_stats_hourly';

export const createEmptyCounters = (): ProbeTestCounters => ({ assigned: 0, finished: 0, failedTarget: 0, failedResolver: 0, failedInternal: 0, timedOut: 0 });

const createEmptyTests = () => _.zipObject(PROBE_TEST_TYPES, PROBE_TEST_TYPES.map(createEmptyCounters)) as Record<RequestType, ProbeTestCounters>;

export class ProbeTestStatsStorage {
	constructor (private readonly sql: Knex) {}

	// The first write of a bucket is final; a bucket restored from an older Redis snapshot must not lower persisted counters.
	async writeHourly (rows: ProbeTestStatsRow[]): Promise<void> {
		for (const chunk of _.chunk(rows, 1000)) {
			await this.sql(TABLE).insert(chunk).onConflict([ 'probeUuid', 'hour', 'testType' ]).ignore();
		}
	}

	async readStats (probeUuid: string, { from, to, interval }: ProbeTestStatsRange): Promise<ProbeTestStatsBucket[]> {
		const rows = await this.sql(TABLE)
			.select(this.sql.raw(`time_bucket(?::interval, "hour") AS "timestamp"`, [ `1 ${interval}` ]), 'testType')
			.sum<ReadRow[]>(_.zipObject(PROBE_TEST_COUNTERS, PROBE_TEST_COUNTERS))
			.where('probeUuid', probeUuid)
			.where('hour', '>=', from)
			.where('hour', '<', to)
			.groupBy('timestamp', 'testType')
			.orderBy([ 'timestamp', 'testType' ]);

		return Object.values(_.groupBy(rows, row => row.timestamp.toISOString())).map(bucketRows => ({
			timestamp: bucketRows[0]!.timestamp,
			tests: {
				...createEmptyTests(),
				...Object.fromEntries(bucketRows.map(row => [ row.testType, _.mapValues(_.pick(row, PROBE_TEST_COUNTERS), Number) ])),
			},
		}));
	}
}

let probeTestStatsStorage: ProbeTestStatsStorage;

export const getProbeTestStatsStorage = () => {
	if (!probeTestStatsStorage) {
		probeTestStatsStorage = new ProbeTestStatsStorage(timeSeriesClient);
	}

	return probeTestStatsStorage;
};
