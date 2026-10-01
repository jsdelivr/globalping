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
		await timeSeriesClient('probe_log').whereIn('probeUuid', PROBE_UUIDS).delete();
		await timeSeriesClient('probe_log_counter').whereIn('probeUuid', PROBE_UUIDS).delete();
	};

	beforeEach(async () => {
		await cleanUp();
		storage = new ProbeLogsStorage(timeSeriesClient);
	});

	afterEach(cleanUp);

	it('assigns sequential IDs across log batches', async () => {
		await storage.writeLogs(PROBE_UUIDS[0]!, createMessage([ 'first' ]));
		await storage.writeLogs(PROBE_UUIDS[0]!, createMessage([ 'second' ]));

		const logs = await timeSeriesClient('probe_log')
			.where('probeUuid', PROBE_UUIDS[0]!)
			.orderBy('probeLogId');
		const counter = await timeSeriesClient('probe_log_counter').where('probeUuid', PROBE_UUIDS[0]!).first();

		expect(logs.map(({ probeLogId, scope }) => ({ probeLogId, scope }))).to.deep.equal([
			{ probeLogId: '1', scope: 'first' },
			{ probeLogId: '2', scope: 'second' },
		]);

		expect(counter.lastAllocatedId).to.equal('2');
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
