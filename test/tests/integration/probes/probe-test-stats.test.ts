import { setTimeout } from 'timers/promises';
import { expect } from 'chai';
import { RESP_TYPES } from 'redis';
import * as sinon from 'sinon';
import { metricsAgent } from '../../../../src/lib/metrics.js';
import { getPersistentNoEvictionRedisClient } from '../../../../src/lib/redis/persistent-no-eviction-client.js';
import { timeSeriesClient } from '../../../../src/lib/sql/client.js';
import { generateMeasurementId } from '../../../../src/measurement/id.js';
import { getProbeTestStats } from '../../../../src/probe/test-stats.js';
import { createEmptyCounters, getProbeTestStatsStorage } from '../../../../src/probe/test-stats-storage.js';
import type { ServerProbe } from '../../../../src/probe/types.js';

const HOUR = 60 * 60 * 1000;
const PROBE_A = 'fb9756c9-a4d7-423f-9ed2-3b848e915159';
const PROBE_B = '1b6c8f3e-7c1a-4f6e-9a0f-2d3c4b5a6e7f';

const TIMEOUT_LOOKALIKE = { status: 'failed', failureSource: 'internal', rawOutput: 'The measurement timed out.' } as const;

describe('Probe test stats collection and persistence', () => {
	const redis = getPersistentNoEvictionRedisClient();
	const probeTestStats = getProbeTestStats();
	const storage = getProbeTestStatsStorage();
	const sandbox = sinon.createSandbox();
	let maxMemory: string;
	let hour: number;

	// PING waits for earlier fire-and-forget commands on this connection.
	const waitForCommands = () => redis.ping();

	const createMeasurementId = () => generateMeasurementId(new Date(hour + 30 * 60 * 1000));
	const getKeys = () => redis.keys('gp:probe-test-stats:*');
	const getBuckets = async () => (await redis.zRange('gp:probe-test-stats:{probe-test-stats}:buckets', 0, -1)).map(Number);
	const expireLease = (bucketHour: number) => redis.set(`gp:probe-test-stats:{probe-test-stats}:${bucketHour}:lease`, Date.now() - 1);
	const toProbes = (...uuids: string[]) => new Map(uuids.map((uuid, index) => [ index, { uuid } as ServerProbe ]));

	const getRows = (rowHour = hour) => timeSeriesClient('probe_test_stats_hourly')
		.select('probeUuid', 'testType', 'assigned', 'finished', 'failedTarget', 'failedResolver', 'failedInternal', 'timedOut')
		.where('hour', new Date(rowHour))
		.orderBy([ 'probeUuid', 'testType' ]);

	before(async () => {
		maxMemory = (await redis.configGet('maxmemory'))['maxmemory']!;
	});

	beforeEach(async () => {
		const keys = await getKeys();
		keys.length && await redis.del(keys);
		await timeSeriesClient('probe_test_stats_hourly').delete();
		hour = Math.floor(Date.now() / HOUR) * HOUR - 3 * HOUR;
	});

	afterEach(async () => {
		sandbox.restore();
		await redis.configSet('maxmemory', maxMemory);
	});

	it('counts each test once and maps every outcome to its counter', async () => {
		const measurementId = createMeasurementId();
		const outcomes = [
			...Array(7).fill({ status: 'finished' }),
			...Array(5).fill({ status: 'failed', failureSource: 'target' }),
			...Array(3).fill({ status: 'failed', failureSource: 'resolver' }),
			{ status: 'failed', failureSource: 'internal' },
			{ status: 'failed' },
			TIMEOUT_LOOKALIKE,
		];

		const probes = toProbes(...Array(outcomes.length + 1).fill(PROBE_A));

		await probeTestStats.recordAssignments(measurementId, 'ping', probes);
		await probeTestStats.recordAssignments(measurementId, 'ping', probes);

		outcomes.forEach((outcome, testId) => probeTestStats.recordResult(measurementId, testId.toString(), outcome));

		probeTestStats.recordResult(measurementId, '0', { status: 'failed', failureSource: 'target' });
		probeTestStats.recordResult(measurementId, '7', { status: 'finished' });

		probeTestStats.recordTimeouts(measurementId, [ outcomes.length ]);
		probeTestStats.recordTimeouts(measurementId, [ outcomes.length ]);

		probeTestStats.recordResult(measurementId, outcomes.length.toString(), { status: 'finished' });
		await waitForCommands();

		await probeTestStats.flush();

		expect(await getRows()).to.deep.equal([
			{ probeUuid: PROBE_A, testType: 'ping', assigned: 19, finished: 7, failedTarget: 5, failedResolver: 3, failedInternal: 4, timedOut: 1 },
		]);
	});

	it('keeps assigned equal to finished plus failed for every test type', async () => {
		const outcomes = [{ status: 'finished' }, { status: 'failed', failureSource: 'target' }, { status: 'failed', failureSource: 'resolver' }, { status: 'failed' }] as const;

		for (const type of [ 'ping', 'traceroute', 'dns', 'http', 'mtr' ] as const) {
			const measurementId = createMeasurementId();
			await probeTestStats.recordAssignments(measurementId, type, toProbes(PROBE_A, PROBE_B, PROBE_A, PROBE_B, PROBE_A, PROBE_B));
			outcomes.forEach((outcome, testId) => probeTestStats.recordResult(measurementId, testId.toString(), outcome));
			probeTestStats.recordTimeouts(measurementId, [ 4, 5 ]);
		}

		await waitForCommands();

		await probeTestStats.flush();

		const rows = await getRows();
		expect(rows).to.have.length(10);

		for (const row of rows) {
			expect(row.assigned).to.equal(3);
			expect(row.assigned).to.equal(row.finished + row.failedTarget + row.failedResolver + row.failedInternal);
			expect(row.timedOut).to.equal(1);
		}
	});

	it('counts a test with no outcome as timed out when its hour is flushed', async () => {
		await probeTestStats.recordAssignments(createMeasurementId(), 'ping', toProbes(PROBE_A));
		await probeTestStats.flush();

		expect(await getRows()).to.deep.equal([{ probeUuid: PROBE_A, testType: 'ping', ...createEmptyCounters(), assigned: 1, failedInternal: 1, timedOut: 1 }]);
		expect(await getKeys()).to.be.empty;
	});

	it('does not persist buckets of the current hour', async () => {
		const measurementId = generateMeasurementId(new Date());
		await probeTestStats.recordAssignments(measurementId, 'ping', toProbes(PROBE_A));
		probeTestStats.recordResult(measurementId, '0', { status: 'finished' });
		await waitForCommands();

		await probeTestStats.flush();

		expect(await timeSeriesClient('probe_test_stats_hourly').count({ count: '*' }).first()).to.deep.equal({ count: '0' });
	});

	it('persists each bucket once across repeated and concurrent flushes', async () => {
		const measurementId = createMeasurementId();
		await probeTestStats.recordAssignments(measurementId, 'mtr', toProbes(PROBE_A, PROBE_B));
		probeTestStats.recordResult(measurementId, '0', { status: 'finished' });
		probeTestStats.recordResult(measurementId, '1', { status: 'failed', failureSource: 'target' });
		await waitForCommands();

		const writeSpy = sandbox.spy(storage, 'writeHourly');
		await Promise.all([ probeTestStats.flush(), probeTestStats.flush(), probeTestStats.flush() ]);
		await probeTestStats.flush();

		expect(writeSpy.callCount).to.equal(1);
		expect(await getKeys()).to.be.empty;

		expect(await getRows()).to.deep.equal([
			{ probeUuid: PROBE_B, testType: 'mtr', ...createEmptyCounters(), assigned: 1, failedTarget: 1 },
			{ probeUuid: PROBE_A, testType: 'mtr', ...createEmptyCounters(), assigned: 1, finished: 1 },
		]);
	});

	it('stops at a failed write, skips the leased bucket and retries it after the lease expires', async () => {
		const hours = [ hour - 2 * HOUR, hour - HOUR, hour ];

		for (const bucketHour of hours) {
			const measurementId = generateMeasurementId(new Date(bucketHour));
			await probeTestStats.recordAssignments(measurementId, 'ping', toProbes(PROBE_A));
			probeTestStats.recordResult(measurementId, '0', { status: 'finished' });
		}

		await waitForCommands();
		const writeStub = sandbox.stub(storage, 'writeHourly').rejects(new Error('Database unavailable.'));

		const error = await probeTestStats.flush().catch((error: unknown) => error);
		expect(error).to.be.instanceOf(Error).with.property('message', 'Database unavailable.');
		expect(writeStub.callCount).to.equal(1);
		expect(writeStub.firstCall.args[0][0]!.hour.getTime()).to.equal(hours[0]);
		expect(await getBuckets()).to.deep.equal(hours);
		expect(await timeSeriesClient('probe_test_stats_hourly').select()).to.be.empty;

		writeStub.restore();
		await probeTestStats.flush();
		expect(await getBuckets()).to.deep.equal([ hours[0] ]);

		await expireLease(hours[0]!);
		await probeTestStats.flush();
		expect(await getKeys()).to.be.empty;

		for (const bucketHour of hours) {
			expect(await getRows(bucketHour)).to.deep.equal([{ probeUuid: PROBE_A, testType: 'ping', ...createEmptyCounters(), assigned: 1, finished: 1 }]);
		}
	});

	it('keeps the persisted totals when a bucket restored from an older Redis snapshot is persisted again', async () => {
		const measurementId = createMeasurementId();
		await probeTestStats.recordAssignments(measurementId, 'ping', toProbes(PROBE_A));

		const keys = await redis.keys('gp:probe-test-stats:*');
		const dumps = await Promise.all(keys.map(key => redis.withTypeMapping({ [RESP_TYPES.BLOB_STRING]: Buffer }).dump(key)));

		const laterMeasurementId = createMeasurementId();
		await probeTestStats.recordAssignments(laterMeasurementId, 'ping', toProbes(PROBE_A));
		probeTestStats.recordResult(measurementId, '0', { status: 'finished' });
		probeTestStats.recordResult(laterMeasurementId, '0', { status: 'finished' });
		await waitForCommands();

		await probeTestStats.flush();
		expect(await getRows()).to.deep.equal([{ probeUuid: PROBE_A, testType: 'ping', ...createEmptyCounters(), assigned: 2, finished: 2 }]);

		await Promise.all(keys.map((key, index) => redis.restore(key, 0, dumps[index]!, { REPLACE: true })));
		await probeTestStats.flush();

		expect(await getKeys()).to.be.empty;
		expect(await getRows()).to.deep.equal([{ probeUuid: PROBE_A, testType: 'ping', ...createEmptyCounters(), assigned: 2, finished: 2 }]);
	});

	it('persists a bucket into an already compressed chunk', async () => {
		const oldHour = hour - 10 * 24 * HOUR;
		await timeSeriesClient('probe_test_stats_hourly').insert({ probeUuid: PROBE_B, hour: new Date(oldHour), testType: 'ping', ...createEmptyCounters(), assigned: 1, finished: 1 });
		await timeSeriesClient.raw(`SELECT compress_chunk(chunk) FROM show_chunks('probe_test_stats_hourly', older_than => INTERVAL '7 days') AS chunk`);

		const chunk = await timeSeriesClient('timescaledb_information.chunks')
			.where({ hypertable_name: 'probe_test_stats_hourly' })
			.where('range_start', '<=', new Date(oldHour))
			.where('range_end', '>', new Date(oldHour))
			.first('is_compressed');

		expect(chunk).to.deep.equal({ is_compressed: true });

		const measurementId = generateMeasurementId(new Date(oldHour));
		await probeTestStats.recordAssignments(measurementId, 'ping', toProbes(PROBE_A, PROBE_B));
		probeTestStats.recordResult(measurementId, '0', { status: 'finished' });
		probeTestStats.recordResult(measurementId, '1', { status: 'failed', failureSource: 'target' });
		await waitForCommands();

		await probeTestStats.flush();

		expect(await getKeys()).to.be.empty;

		expect(await getRows(oldHour)).to.deep.equal([
			{ probeUuid: PROBE_B, testType: 'ping', ...createEmptyCounters(), assigned: 1, finished: 1 },
			{ probeUuid: PROBE_A, testType: 'ping', ...createEmptyCounters(), assigned: 1, finished: 1 },
		]);
	});

	it('rejects new assignments but settles results and persists buckets while Redis is out of memory', async () => {
		const measurementId = createMeasurementId();
		await probeTestStats.recordAssignments(measurementId, 'ping', toProbes(PROBE_A, PROBE_A));

		const errorSpy = sandbox.spy(metricsAgent, 'recordProbeTestStatsError');
		await redis.configSet('maxmemory', '1');

		await probeTestStats.recordAssignments(createMeasurementId(), 'ping', toProbes(PROBE_B));
		probeTestStats.recordResult(measurementId, '0', { status: 'finished' });
		await waitForCommands();
		expect(errorSpy.args).to.deep.equal([ [ 'assignment' ] ]);

		await probeTestStats.flush();
		expect(await getKeys()).to.be.empty;

		expect(await getRows()).to.deep.equal([{ probeUuid: PROBE_A, testType: 'ping', ...createEmptyCounters(), assigned: 2, finished: 1, failedInternal: 1, timedOut: 1 }]);
	});

	it('records errors instead of rejecting when the stats Redis rejects commands', async () => {
		sandbox.stub(redis, 'recordProbeTestAssignments').rejects(new Error('Redis unavailable.'));
		sandbox.stub(redis, 'settleProbeTests').rejects(new Error('Redis unavailable.'));
		const errorSpy = sandbox.spy(metricsAgent, 'recordProbeTestStatsError');

		const measurementId = createMeasurementId();
		await probeTestStats.recordAssignments(measurementId, 'ping', toProbes(PROBE_A));
		probeTestStats.recordResult(measurementId, '0', { status: 'finished' });
		await setTimeout(10);

		expect(errorSpy.args).to.deep.equal([ [ 'assignment' ], [ 'result' ] ]);
	});

	it('reports the flush backlog', async () => {
		const measurementId = createMeasurementId();
		await probeTestStats.recordAssignments(measurementId, 'ping', toProbes(PROBE_A, PROBE_B));

		const backlog = await probeTestStats.getFlushBacklog();
		expect(backlog.count).to.equal(1);
		expect(backlog.oldestAge).to.be.closeTo(Date.now() - hour - HOUR, 1000);
	});

	it('compresses data after 7 days and removes it after 14 months', async () => {
		const jobs = await timeSeriesClient('timescaledb_information.jobs')
			.select<{ job_id: number; proc_name: string; config: Record<string, string> }[]>('job_id', 'proc_name', 'config')
			.where('hypertable_name', 'probe_test_stats_hourly');

		expect(jobs.find(job => job.proc_name === 'policy_compression')?.config['compress_after']).to.equal('7 days');

		const rows = await timeSeriesClient('probe_test_stats_hourly').insert([
			{ probeUuid: PROBE_A, hour: timeSeriesClient.raw(`date_trunc('hour', CURRENT_TIMESTAMP - INTERVAL '15 months')`), testType: 'ping', ...createEmptyCounters(), assigned: 1, finished: 1 },
			{ probeUuid: PROBE_A, hour: timeSeriesClient.raw(`date_trunc('hour', CURRENT_TIMESTAMP - INTERVAL '13 months')`), testType: 'ping', ...createEmptyCounters(), assigned: 3, finished: 3 },
			{ probeUuid: PROBE_A, hour: new Date(hour), testType: 'ping', ...createEmptyCounters(), assigned: 2, finished: 2 },
		]).returning([ 'hour', 'assigned' ]);

		const retentionJob = jobs.find(job => job.proc_name === 'policy_retention');
		expect(retentionJob).to.not.equal(undefined);
		await timeSeriesClient.raw('CALL run_job(?)', [ retentionJob!.job_id ]);

		expect(await timeSeriesClient('probe_test_stats_hourly').select('hour', 'assigned').orderBy('hour')).to.deep.equal(rows.slice(1));
	});
});
