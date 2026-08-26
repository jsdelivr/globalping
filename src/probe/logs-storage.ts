import type { Knex } from 'knex';
import type { LogMessage } from './handler/logs.js';
import { timeSeriesClient } from '../lib/sql/client.js';

const READ_LIMIT = 1000;
const CLEANUP_INTERVAL = 10_000n;
const MAX_RETAINED_LOGS = 100_000n;
const MAX_SCOPES_PER_PROBE = 100;
const MIN_SCOPE_PROBES = 2;
const SCOPE_OPTIONS_LIMIT = 100;
const SCOPE_REFRESH_INTERVAL = '1 hour';
const SCOPE_RETENTION = '30 days';

export type ProbeLog = {
	probeLogId: string;
	timestamp: Date | null;
	level: string | null;
	scope: string | null;
	message: string;
};

export type ProbeLogFilters = {
	after?: string | undefined;
	before?: string | undefined;
	scopes?: string[] | undefined;
	search?: string | undefined;
};

type ProbeLogReadResult = {
	logs: ProbeLog[];
	lastId: string | null;
	firstId: string | null;
	hasOlder: boolean;
};

const escapeLikePattern = (value: string) => value
	.replaceAll('\\', '\\\\')
	.replaceAll('%', '\\%')
	.replaceAll('_', '\\_');

export class ProbeLogsStorage {
	constructor (private readonly sql: Knex) {}

	async readScopes (): Promise<string[]> {
		const result = await this.sql.raw<{ rows: { scope: string }[] }>(`
			SELECT "scope"
			FROM probe_log_scope
			WHERE "lastSeenAt" >= now() - ?::interval
				AND "scope" !~ '(^[[:space:]]|[[:space:]]$|,)'
			GROUP BY "scope"
			HAVING count(*) >= ?
			ORDER BY count(*) DESC, "scope" ASC
			LIMIT ?
		`, [ SCOPE_RETENTION, MIN_SCOPE_PROBES, SCOPE_OPTIONS_LIMIT ]);

		return result.rows.map(({ scope }) => scope);
	}

	async readLogs (probeUuid: string, filters: ProbeLogFilters = {}): Promise<ProbeLogReadResult> {
		const { after, before, scopes = [], search } = filters;

		const createBaseQuery = (sql: Knex) => sql<ProbeLog>('probe_log')
			.where('probeUuid', probeUuid)
			.whereRaw(`"receivedAt" >= now() - interval '30 days'`);

		const createFilteredQuery = (sql: Knex) => {
			const query = createBaseQuery(sql);

			if (scopes.length > 0) {
				query.whereIn('scope', scopes);
			}

			if (search) {
				query.whereRaw('"message" ILIKE ?', [ `%${escapeLikePattern(search)}%` ]);
			}

			return query;
		};

		return this.sql.transaction(async (transaction) => {
			// find the actual lastId across ALL logs
			const latestLog = await createBaseQuery(transaction)
				.select('probeLogId')
				.orderBy('probeLogId', 'desc')
				.first();

			const lastId = latestLog?.probeLogId ?? null;

			if (lastId === null || (after && BigInt(after) >= BigInt(lastId))) {
				return { logs: [], lastId: after ?? lastId, firstId: null, hasOlder: false };
			}

			const query = createFilteredQuery(transaction);

			if (after) {
				void query.where('probeLogId', '>', after);
			}

			if (before) {
				void query.where('probeLogId', '<', before);
			}

			// fetch one extra log to detect older history
			const logs = await query
				.select('probeLogId', 'timestamp', 'level', 'scope', 'message')
				.orderBy('probeLogId', 'desc')
				.limit(READ_LIMIT + 1);

			const retainedLogs = logs.slice(0, READ_LIMIT);
			const firstId = retainedLogs[retainedLogs.length - 1]?.probeLogId ?? null;

			return {
				logs: retainedLogs.reverse(),
				lastId,
				firstId,
				hasOlder: logs.length > READ_LIMIT,
			};
		}, { isolationLevel: 'repeatable read', readOnly: true });
	}

	async writeLogs (probeUuid: string, logMessage: LogMessage, trackScopes: boolean): Promise<void> {
		const receivedAt = new Date();

		const logs: Array<{
			message: string;
			timestamp: string | null;
			level: string | null;
			scope: string | null;
		}> = logMessage.logs.map(log => ({ ...log }));

		if (logMessage.skipped > 0) {
			logs.unshift({
				message: `...${logMessage.skipped} messages skipped...`,
				timestamp: null,
				level: null,
				scope: null,
			});
		}

		if (logs.length === 0) {
			return;
		}

		const logScopes = trackScopes
			? [ ...new Set(logs
				.map(({ scope }) => scope)
				.filter((scope): scope is string => !!scope && scope === scope.trim() && !scope.includes(','))) ]
			: [];

		await this.sql.transaction(async (transaction) => {
			const allocation = await transaction.raw<{ rows: { lastAllocatedId: string }[] }>(`
				INSERT INTO probe_log_counter ("probeUuid", "lastAllocatedId")
				VALUES (?, ?)
				ON CONFLICT ("probeUuid") DO UPDATE
				SET "lastAllocatedId" = probe_log_counter."lastAllocatedId" + EXCLUDED."lastAllocatedId"
				RETURNING "lastAllocatedId"::text AS "lastAllocatedId"
			`, [ probeUuid, logs.length ]);

			const newLastAllocatedId = BigInt(allocation.rows[0]!.lastAllocatedId);
			const previousLastAllocatedId = newLastAllocatedId - BigInt(logs.length);

			if (logScopes.length > 0) {
				const existingScopeRows = await transaction<{ scope: string }>('probe_log_scope')
					.select('scope')
					.where('probeUuid', probeUuid);

				const existingScopes = new Set(existingScopeRows.map(({ scope }) => scope));
				const availableSlots = Math.max(0, MAX_SCOPES_PER_PROBE - existingScopes.size);
				const newScopes = logScopes.filter(scope => !existingScopes.has(scope)).slice(0, availableSlots);
				const retainedScopes = logScopes.filter(scope => existingScopes.has(scope)).concat(newScopes);

				if (retainedScopes.length > 0) {
					await transaction('probe_log_scope')
						.insert(retainedScopes.map(scope => ({ probeUuid, scope, lastSeenAt: transaction.fn.now() })))
						.onConflict([ 'probeUuid', 'scope' ])
						.merge({
							lastSeenAt: transaction.raw('GREATEST(probe_log_scope."lastSeenAt", EXCLUDED."lastSeenAt")'),
						})
						.whereRaw('probe_log_scope."lastSeenAt" < EXCLUDED."lastSeenAt" - ?::interval', [ SCOPE_REFRESH_INTERVAL ]);
				}
			}

			await transaction('probe_log').insert(logs.map((log, index) => ({
				probeUuid,
				probeLogId: (previousLastAllocatedId + BigInt(index) + 1n).toString(),
				timestamp: log.timestamp,
				receivedAt,
				level: log.level,
				scope: log.scope,
				message: log.message,
			})));

			if (previousLastAllocatedId / CLEANUP_INTERVAL !== newLastAllocatedId / CLEANUP_INTERVAL) {
				await transaction('probe_log')
					.where({ probeUuid })
					.where('probeLogId', '<=', (newLastAllocatedId - MAX_RETAINED_LOGS).toString())
					.delete();
			}
		});
	}
}

let probeLogsStorage: ProbeLogsStorage;

export const getProbeLogStorage = () => {
	if (!probeLogsStorage) {
		probeLogsStorage = new ProbeLogsStorage(timeSeriesClient);
	}

	return probeLogsStorage;
};
