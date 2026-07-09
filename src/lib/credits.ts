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

const logger = scopedLogger('credits');

export class Credits {
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

	async consume (userId: string, credits: number): Promise<{ isConsumed: boolean; remainingCredits: number }> {
		const result = this.consumeFromBuffer(userId, credits);

		if (result) { return result; }

		const { isConsumed, remainingCredits } = await this.consumeFromDb(userId, credits);
		return { isConsumed, remainingCredits: this.updateBuffer(userId, remainingCredits) };
	}

	async getRemainingCredits (userId: string): Promise<number> {
		const remainingFromDb = await this.getRemainingCreditsFromDb(userId);
		const entry = this.buffer.get(userId);

		if (!entry) {
			return remainingFromDb;
		}

		entry.remaining = Math.max(remainingFromDb - entry.pending, 0);
		return entry.remaining;
	}

	async flush (): Promise<void> {
		await Bluebird.map([ ...this.buffer.entries() ].filter(([ , entry ]) => entry.pending), async ([ userId, entry ]) => {
			const flushed = entry.pending;
			entry.pending = 0;

			try {
				await this.sql(CREDITS_TABLE).where({ user_id: userId }).update({ amount: this.sql.raw('amount - ?', [ flushed ]) });
			} catch (error) {
				if ((error as Error & { errno?: number }).errno === ER_CONSTRAINT_FAILED_CODE) {
					logger.warn(`Dropped ${flushed} buffered credits of user ${userId} that exceed the current balance.`);
				} else {
					entry.pending += flushed;
					this.buffer.set(userId, entry);
					logger.error('Failed to flush buffered credits.', error);
					return;
				}
			}

			try {
				entry.remaining = Math.max(await this.getRemainingCreditsFromDb(userId) - entry.pending, 0);
			} catch (error) {
				logger.error('Failed to refresh the remaining credits.', error);
			}
		}, { concurrency: 8 });
	}

	private consumeFromBuffer (userId: string, credits: number): { isConsumed: boolean; remainingCredits: number } | null {
		const entry = this.buffer.get(userId);

		if (!entry || entry.remaining - credits < MIN_CREDITS_FOR_BUFFER) {
			return null;
		}

		entry.remaining -= credits;
		entry.pending += credits;
		this.buffer.set(userId, entry);
		return { isConsumed: true, remainingCredits: entry.remaining };
	}

	private async consumeFromDb (userId: string, credits: number): Promise<{ isConsumed: boolean; remainingCredits: number }> {
		let numberOfUpdates: number;

		try {
			numberOfUpdates = await this.sql(CREDITS_TABLE).where({ user_id: userId }).update({ amount: this.sql.raw('amount - ?', [ credits ]) });
		} catch (error) {
			if (error && (error as Error & { errno?: number }).errno === ER_CONSTRAINT_FAILED_CODE) {
				const remainingCredits = await this.getRemainingCreditsFromDb(userId);
				return { isConsumed: false, remainingCredits };
			}

			throw error;
		}

		if (numberOfUpdates === 0) {
			return { isConsumed: false, remainingCredits: 0 };
		}

		const remainingCredits = await this.getRemainingCreditsFromDb(userId);
		return { isConsumed: true, remainingCredits };
	}

	private async getRemainingCreditsFromDb (userId: string): Promise<number> {
		const result = await this.sql(CREDITS_TABLE).where({ user_id: userId }).first<{ amount: number } | undefined>('amount');
		return result?.amount || 0;
	}

	private updateBuffer (userId: string, remainingFromDb: number): number {
		const entry = this.buffer.get(userId);
		const pending = entry?.pending ?? 0;
		const remaining = Math.max(remainingFromDb - pending, 0);

		if (remaining >= MIN_CREDITS_FOR_BUFFER) {
			this.buffer.set(userId, { remaining, pending });
		} else if (entry) {
			entry.remaining = remaining;

			if (!entry.pending) {
				this.buffer.delete(userId);
			}
		}

		return remaining;
	}
}

export const credits = new Credits(dashboardClient);
