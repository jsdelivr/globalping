import cluster from 'node:cluster';
import type { Knex } from 'knex';
import Bluebird from 'bluebird';
import { TTLCache } from '@isaacs/ttlcache';
import { scopedLogger } from './logger.js';
import { dashboardClient } from './sql/client.js';

export const CREDITS_TABLE = 'gp_credits';
const ER_CONSTRAINT_FAILED_CODE = 4025;
const MIN_CREDITS_FOR_BUFFER = 10_000;
const FLUSH_INTERVAL = 1000;
const IDLE_ENTRY_TTL = 60_000;

const logger = scopedLogger('credits-master');

export type ConsumeResult = { isConsumed: boolean; remainingCredits: number };

export interface Credits {
	consume (accountId: string, credits: number): Promise<ConsumeResult>;
	getRemainingCredits (accountId: string): Promise<number>;
}

export class CreditsMaster implements Credits {
	private readonly buffer = new TTLCache<string, { remaining: number; pending: number }>({ ttl: IDLE_ENTRY_TTL });

	constructor (private readonly sql: Knex) {
		this.scheduleFlush();
	}

	private scheduleFlush () {
		setTimeout(() => {
			this.flush()
				.finally(() => this.scheduleFlush())
				.catch(error => logger.error('Failed to flush the credits buffer.', error));
		}, FLUSH_INTERVAL).unref();
	}

	async consume (accountId: string, credits: number): Promise<ConsumeResult> {
		const result = this.consumeFromBuffer(accountId, credits);

		if (result) { return result; }

		const { isConsumed, remainingCredits } = await this.consumeFromDb(accountId, credits);
		return { isConsumed, remainingCredits: this.updateBuffer(accountId, remainingCredits) };
	}

	async getRemainingCredits (accountId: string): Promise<number> {
		const remainingFromDb = await this.getRemainingCreditsFromDb(accountId);
		const entry = this.buffer.get(accountId);

		if (!entry) {
			return remainingFromDb;
		}

		entry.remaining = Math.max(remainingFromDb - entry.pending, 0);
		return entry.remaining;
	}

	async flush (): Promise<void> {
		await Bluebird.map([ ...this.buffer.entries() ].filter(([ , entry ]) => entry.pending), async ([ accountId, entry ]) => {
			const flushed = entry.pending;
			entry.pending = 0;

			try {
				await this.sql(CREDITS_TABLE).where({ account_id: accountId }).update({ amount: this.sql.raw('GREATEST(amount - ?, 0)', [ flushed ]) });
			} catch (error) {
				entry.pending += flushed;
				this.buffer.set(accountId, entry);
				logger.error('Failed to flush buffered credits.', error);
				return;
			}

			try {
				entry.remaining = Math.max(await this.getRemainingCreditsFromDb(accountId) - entry.pending, 0);
			} catch (error) {
				logger.error('Failed to refresh the remaining credits.', error);
			}
		}, { concurrency: 8 });
	}

	private consumeFromBuffer (accountId: string, credits: number): ConsumeResult | null {
		const entry = this.buffer.get(accountId);

		if (!entry || entry.remaining - credits < MIN_CREDITS_FOR_BUFFER) {
			return null;
		}

		entry.remaining -= credits;
		entry.pending += credits;
		this.buffer.set(accountId, entry);
		return { isConsumed: true, remainingCredits: entry.remaining };
	}

	private async consumeFromDb (accountId: string, credits: number): Promise<ConsumeResult> {
		let numberOfUpdates: number;

		try {
			numberOfUpdates = await this.sql(CREDITS_TABLE).where({ account_id: accountId }).update({ amount: this.sql.raw('amount - ?', [ credits ]) });
		} catch (error) {
			if (error && (error as Error & { errno?: number }).errno === ER_CONSTRAINT_FAILED_CODE) {
				const remainingCredits = await this.getRemainingCreditsFromDb(accountId);
				return { isConsumed: false, remainingCredits };
			}

			throw error;
		}

		if (numberOfUpdates === 0) {
			return { isConsumed: false, remainingCredits: 0 };
		}

		const remainingCredits = await this.getRemainingCreditsFromDb(accountId);
		return { isConsumed: true, remainingCredits };
	}

	private async getRemainingCreditsFromDb (accountId: string): Promise<number> {
		const result = await this.sql(CREDITS_TABLE).where({ account_id: accountId }).first<{ amount: number } | undefined>('amount');
		return result?.amount || 0;
	}

	private updateBuffer (accountId: string, remainingFromDb: number): number {
		const entry = this.buffer.get(accountId);
		const pending = entry?.pending ?? 0;
		const remaining = Math.max(remainingFromDb - pending, 0);

		if (remaining >= MIN_CREDITS_FOR_BUFFER) {
			this.buffer.set(accountId, { remaining, pending });
		} else if (entry) {
			entry.remaining = remaining;

			if (!entry.pending) {
				this.buffer.delete(accountId);
			}
		}

		return remaining;
	}
}

export const creditsMaster = cluster.isPrimary ? new CreditsMaster(dashboardClient) : undefined;
