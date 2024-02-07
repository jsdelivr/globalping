import type { Knex } from 'knex';
import { client } from './sql/client.js';

export const CREDITS_TABLE = 'gp_credits';
const ER_CONSTRAINT_FAILED_CODE = 4025;

export class Credits {
	constructor (private readonly sql: Knex) {}

	async consume (userId: string, credits: number): Promise<{ isConsumed: boolean, remainingCredits?: number }> {
		try {
			const result = await this.sql.raw<[[{amount: number | null}]]>(`
				INSERT INTO ?? (user_id, amount)
				VALUES (?, ?)
				ON DUPLICATE KEY UPDATE
				amount = amount - ?
				RETURNING amount
			`, [ CREDITS_TABLE, userId, null, credits ]);

			const remainingCredits = result[0]?.[0]?.amount;

			if (remainingCredits || remainingCredits === 0) {
				return { isConsumed: true, remainingCredits };
			}

			return { isConsumed: false };
		} catch (error) {
			if (error && (error as Error & {errno?: number}).errno === ER_CONSTRAINT_FAILED_CODE) {
				return { isConsumed: false };
			}

			throw error;
		}
	}
}

export const credits = new Credits(client);
