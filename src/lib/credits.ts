import type { Knex } from 'knex';
import { client } from './sql/client.js';

export const CREDITS_TABLE = 'gp_credits';
const ER_CONSTRAINT_FAILED_CODE = 4025;

export class Credits {
	constructor (private readonly sql: Knex) {}

	async consume (userId: string, credits: number): Promise<{ isConsumed: boolean; remainingCredits: number }> {
		let numberOfUpdates = null;

		try {
			numberOfUpdates = await this.sql(CREDITS_TABLE).where({ user_id: userId }).update({ amount: this.sql.raw('amount - ?', [ credits ]) });
		} catch (error) {
			if (error && (error as Error & { errno?: number }).errno === ER_CONSTRAINT_FAILED_CODE) {
				const remainingCredits = await this.getRemainingCredits(userId);
				return { isConsumed: false, remainingCredits };
			}

			throw error;
		}

		if (numberOfUpdates === 0) {
			return { isConsumed: false, remainingCredits: 0 };
		}

		const remainingCredits = await this.getRemainingCredits(userId);
		return { isConsumed: true, remainingCredits };
	}

	async getRemainingCredits (userId: string): Promise<number> {
		const result = await this.sql(CREDITS_TABLE).where({ user_id: userId }).first<{ amount: number } | undefined>('amount');
		return result?.amount || 0;
	}
}

export const credits = new Credits(client);
