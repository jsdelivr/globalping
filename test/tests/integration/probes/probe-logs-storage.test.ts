import { expect } from 'chai';
import { timeSeriesClient } from '../../../../src/lib/sql/client.js';
import { ProbeLogsStorage } from '../../../../src/probe/logs-storage.js';
import type { LogMessage } from '../../../../src/probe/handler/logs.js';

describe('Probe Logs Storage', () => {
	const PROBE_UUIDS = Array.from({ length: 105 }, (_, index) => `a11ce000-0000-4000-8000-${String(index).padStart(12, '0')}`);
	let storage: ProbeLogsStorage;

	const createMessage = (scopes: string[]): LogMessage => ({
		skipped: 0,
		logs: scopes.map((scope, index) => ({
			message: `message ${index}`,
			timestamp: '2026-08-25T10:00:00.000Z',
			level: 'info',
			scope,
		})),
	});

	const insertLogs = async (logs: Array<{
		id: string;
		message: string;
		timestamp?: string | null;
		receivedAt?: Date | ReturnType<typeof timeSeriesClient.raw>;
		level?: string | null;
		scope?: string | null;
		probeUuid?: string;
	}>) => timeSeriesClient('probe_log').insert(logs.map(log => ({
		probeUuid: log.probeUuid ?? PROBE_UUIDS[0]!,
		probeLogId: log.id,
		timestamp: log.timestamp === undefined ? '2026-08-25T10:00:00.000Z' : log.timestamp,
		receivedAt: log.receivedAt ?? new Date(),
		level: log.level === undefined ? 'info' : log.level,
		scope: log.scope === undefined ? 'system' : log.scope,
		message: log.message,
	})));

	const cleanUp = async () => {
		await timeSeriesClient('probe_log_scope').delete();
		await timeSeriesClient('probe_log').whereIn('probeUuid', PROBE_UUIDS).delete();
		await timeSeriesClient('probe_log_counter').whereIn('probeUuid', PROBE_UUIDS).delete();
	};

	beforeEach(async () => {
		await cleanUp();
		storage = new ProbeLogsStorage(timeSeriesClient);
	});

	afterEach(cleanUp);

	it('persists unadopted logs and backfills their scopes after adoption', async () => {
		await storage.writeLogs(PROBE_UUIDS[0]!, createMessage([ 'ignored' ]), false);

		const logs = await timeSeriesClient('probe_log').where('probeUuid', PROBE_UUIDS[0]!);
		const counter = await timeSeriesClient('probe_log_counter').where('probeUuid', PROBE_UUIDS[0]!).first();
		const ignoredScopes = await timeSeriesClient('probe_log_scope').where('probeUuid', PROBE_UUIDS[0]!);

		expect(logs).to.have.length(1);
		expect(counter.lastAllocatedId).to.equal('1');
		expect(ignoredScopes).to.be.empty;

		await storage.writeLogs(PROBE_UUIDS[0]!, createMessage([ 'tracked' ]), true);

		const updatedLogs = await timeSeriesClient('probe_log').where('probeUuid', PROBE_UUIDS[0]!);
		const updatedCounter = await timeSeriesClient('probe_log_counter').where('probeUuid', PROBE_UUIDS[0]!).first();
		const trackedScopes = await timeSeriesClient('probe_log_scope')
			.where('probeUuid', PROBE_UUIDS[0]!)
			.orderBy('scope');

		expect(updatedLogs).to.have.length(2);
		expect(updatedCounter.lastAllocatedId).to.equal('2');
		expect(trackedScopes.map(({ scope }) => scope)).to.deep.equal([ 'ignored', 'tracked' ]);
	});

	it('stores each scope once and caps concurrent writes for one probe at 100 scopes', async () => {
		const firstScopes = Array.from({ length: 60 }, (_, index) => `scope-${String(index).padStart(3, '0')}`);
		const secondScopes = Array.from({ length: 60 }, (_, index) => `scope-${String(index + 59).padStart(3, '0')}`);

		await Promise.all([
			storage.writeLogs(PROBE_UUIDS[0]!, createMessage(firstScopes), true),
			storage.writeLogs(PROBE_UUIDS[0]!, createMessage(secondScopes), true),
		]);

		const storedScopes = await timeSeriesClient('probe_log_scope')
			.select('scope')
			.where('probeUuid', PROBE_UUIDS[0]!)
			.orderBy('scope');

		expect(storedScopes).to.have.length(100);
		expect(new Set(storedScopes.map(({ scope }) => scope)).size).to.equal(100);
	});

	it('ranks scopes by contributing probe count instead of message volume', async () => {
		await storage.writeLogs(PROBE_UUIDS[0]!, createMessage(Array.from({ length: 50 }, () => 'volume')), true);
		await storage.writeLogs(PROBE_UUIDS[1]!, createMessage(Array.from({ length: 50 }, () => 'volume')), true);
		await storage.writeLogs(PROBE_UUIDS[2]!, createMessage([ 'shared' ]), true);
		await storage.writeLogs(PROBE_UUIDS[3]!, createMessage([ 'shared' ]), true);
		await storage.writeLogs(PROBE_UUIDS[4]!, createMessage([ 'shared' ]), true);
		await storage.writeLogs(PROBE_UUIDS[5]!, createMessage([ 'zeta' ]), true);
		await storage.writeLogs(PROBE_UUIDS[6]!, createMessage([ 'zeta' ]), true);
		await storage.writeLogs(PROBE_UUIDS[7]!, createMessage([ 'alpha' ]), true);
		await storage.writeLogs(PROBE_UUIDS[8]!, createMessage([ 'alpha' ]), true);

		expect(await storage.readScopes()).to.deep.equal([ 'shared', 'alpha', 'volume', 'zeta' ]);
	});

	it('does not discover scopes that cannot round-trip through the filter query', async () => {
		const scopes = [ 'foo,bar', ' worker ' ];

		await storage.writeLogs(PROBE_UUIDS[0]!, createMessage(scopes), true);
		await storage.writeLogs(PROBE_UUIDS[1]!, createMessage(scopes), true);

		expect(await storage.readScopes()).to.be.empty;
		expect(await timeSeriesClient('probe_log_scope')).to.be.empty;
		expect(await timeSeriesClient('probe_log')).to.have.length(4);
	});

	it('ignores expired scopes when enforcing the cap and refreshes them when reported again', async () => {
		await timeSeriesClient('probe_log_scope').insert([
			{
				probeUuid: PROBE_UUIDS[0]!,
				scope: 'reported-again',
				lastSeenAt: timeSeriesClient.raw(`now() - interval '30 days 1 minute'`),
			},
			{
				probeUuid: PROBE_UUIDS[1]!,
				scope: 'expired',
				lastSeenAt: timeSeriesClient.raw(`now() - interval '30 days 1 minute'`),
			},
			...Array.from({ length: 99 }, (_, index) => ({
				probeUuid: PROBE_UUIDS[0]!,
				scope: `expired-${index}`,
				lastSeenAt: timeSeriesClient.raw(`now() - interval '30 days 1 minute'`),
			})),
		]);

		expect(await storage.readScopes()).to.be.empty;

		await storage.writeLogs(PROBE_UUIDS[0]!, createMessage([ 'reported-again', 'new-after-expiry' ]), true);

		const refreshed = await timeSeriesClient('probe_log_scope')
			.where({ probeUuid: PROBE_UUIDS[0]!, scope: 'reported-again' })
			.first();
		const added = await timeSeriesClient('probe_log_scope')
			.where({ probeUuid: PROBE_UUIDS[0]!, scope: 'new-after-expiry' })
			.first();

		expect(refreshed.lastSeenAt).to.be.instanceof(Date);
		expect(added.lastSeenAt).to.be.instanceof(Date);
		expect(await storage.readScopes()).to.be.empty;

		await storage.writeLogs(PROBE_UUIDS[1]!, createMessage([ 'reported-again' ]), true);

		expect(await storage.readScopes()).to.deep.equal([ 'reported-again' ]);
	});

	it('throttles scope refreshes and keeps lastSeenAt monotonic', async () => {
		await storage.writeLogs(PROBE_UUIDS[0]!, createMessage([ 'system' ]), true);

		const initial = await timeSeriesClient('probe_log_scope').where('probeUuid', PROBE_UUIDS[0]!).first();
		await storage.writeLogs(PROBE_UUIDS[0]!, createMessage([ 'system' ]), true);
		const throttled = await timeSeriesClient('probe_log_scope').where('probeUuid', PROBE_UUIDS[0]!).first();

		expect(throttled.lastSeenAt).to.deep.equal(initial.lastSeenAt);

		await timeSeriesClient('probe_log_scope')
			.where('probeUuid', PROBE_UUIDS[0]!)
			.update({ lastSeenAt: timeSeriesClient.raw(`now() + interval '1 day'`) });

		const future = await timeSeriesClient('probe_log_scope').where('probeUuid', PROBE_UUIDS[0]!).first();

		await storage.writeLogs(PROBE_UUIDS[0]!, createMessage([ 'system' ]), true);
		const monotonic = await timeSeriesClient('probe_log_scope').where('probeUuid', PROBE_UUIDS[0]!).first();

		expect(monotonic.lastSeenAt).to.deep.equal(future.lastSeenAt);

		await timeSeriesClient('probe_log_scope')
			.where('probeUuid', PROBE_UUIDS[0]!)
			.update({ lastSeenAt: timeSeriesClient.raw(`now() - interval '2 hours'`) });

		const stale = await timeSeriesClient('probe_log_scope').where('probeUuid', PROBE_UUIDS[0]!).first();

		await storage.writeLogs(PROBE_UUIDS[0]!, createMessage([ 'system' ]), true);
		const refreshed = await timeSeriesClient('probe_log_scope').where('probeUuid', PROBE_UUIDS[0]!).first();

		expect(refreshed.lastSeenAt).to.be.greaterThan(stale.lastSeenAt);
	});

	it('registers a daily database job that removes expired scopes', async () => {
		await timeSeriesClient('probe_log_scope').insert([
			{
				probeUuid: PROBE_UUIDS[0]!,
				scope: 'expired',
				lastSeenAt: timeSeriesClient.raw(`now() - interval '30 days 1 minute'`),
			},
			{
				probeUuid: PROBE_UUIDS[1]!,
				scope: 'current',
				lastSeenAt: new Date(),
			},
		]);

		const result = await timeSeriesClient.raw<{ rows: Array<{ jobId: number; schedule: string }> }>(`
			SELECT job_id AS "jobId", schedule_interval::text AS "schedule"
			FROM timescaledb_information.jobs
			WHERE proc_schema = 'public' AND proc_name = 'cleanup_probe_log_scopes'
		`);

		expect(result.rows).to.have.length(1);
		expect(result.rows[0]!.schedule).to.equal('1 day');

		await timeSeriesClient.raw('CALL run_job(?)', [ result.rows[0]!.jobId ]);

		const scopes = await timeSeriesClient('probe_log_scope').select('scope');

		expect(scopes.map(({ scope }) => scope)).to.deep.equal([ 'current' ]);
	});

	it('filters scopes exactly and case-sensitively', async () => {
		await insertLogs([
			{ id: '1', message: 'system', scope: 'system' },
			{ id: '2', message: 'worker', scope: 'worker' },
			{ id: '3', message: 'api', scope: 'api:connect' },
			{ id: '4', message: 'case mismatch', scope: 'System' },
			{ id: '5', message: 'synthetic', timestamp: null, level: null, scope: null },
		]);

		const filtered = await storage.readLogs(PROBE_UUIDS[0]!, { scopes: [ 'system', 'worker', 'api:connect' ] });
		const caseSensitive = await storage.readLogs(PROBE_UUIDS[0]!, { scopes: [ 'system' ] });
		const unfiltered = await storage.readLogs(PROBE_UUIDS[0]!);

		expect(filtered.logs.map(({ message }) => message)).to.deep.equal([ 'system', 'worker', 'api' ]);
		expect(caseSensitive.logs.map(({ message }) => message)).to.deep.equal([ 'system' ]);

		expect(unfiltered.logs[4]).to.deep.equal({
			probeLogId: '5',
			timestamp: null,
			level: null,
			scope: null,
			message: 'synthetic',
		});
	});

	it('searches case-insensitively and treats patterns as literal text', async () => {
		await insertLogs([
			{ id: '1', message: 'MiXeDCaSe' },
			{ id: '2', message: 'literal % percent' },
			{ id: '3', message: 'literal _ underscore' },
			{ id: '4', message: 'literal \\ backslash' },
			{ id: '5', message: 'plain text' },
		]);

		for (const [ search, expected ] of [
			[ 'mixedcase', 'MiXeDCaSe' ],
			[ '%', 'literal % percent' ],
			[ '_', 'literal _ underscore' ],
			[ '\\', 'literal \\ backslash' ],
		]) {
			const result = await storage.readLogs(PROBE_UUIDS[0]!, { search });

			expect(result.logs.map(({ message }) => message)).to.deep.equal([ expected ]);
		}
	});

	it('combines cursors, scope, search, UUID, and retention conditions', async () => {
		await insertLogs([
			{ id: '1', message: 'needle before cursor', scope: 'worker' },
			{ id: '2', message: 'needle wrong scope', scope: 'system' },
			{ id: '3', message: 'needle match', scope: 'worker' },
			{ id: '4', message: 'needle at boundary', scope: 'worker' },
			{ id: '5', message: 'needle expired', scope: 'worker', receivedAt: timeSeriesClient.raw(`now() - interval '30 days 1 second'`) },
			{ id: '6', message: 'needle other probe', scope: 'worker', probeUuid: PROBE_UUIDS[1]! },
		]);

		const expiredLog = await timeSeriesClient('probe_log')
			.where({ probeUuid: PROBE_UUIDS[0]!, probeLogId: '5' });

		expect(expiredLog).to.have.length(1);

		const result = await storage.readLogs(PROBE_UUIDS[0]!, {
			after: '1',
			before: '4',
			scopes: [ 'worker' ],
			search: 'NEEDLE',
		});

		expect(result).to.deep.equal({
			logs: [{
				probeLogId: '3',
				timestamp: new Date('2026-08-25T10:00:00.000Z'),
				level: 'info',
				scope: 'worker',
				message: 'needle match',
			}],
			lastId: '4',
			firstId: '3',
			hasOlder: false,
		});
	});
});
