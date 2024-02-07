import type { Knex } from 'knex';
import { client } from './sql/client.js';

export const CREDITS_TABLE = 'gp_credits';
const ER_CONSTRAINT_FAILED_CODE = 4025;

export class Credits {
	constructor (private readonly sql: Knex) {}

	async consume (userId: string, credits: number): Promise<{ isConsumed: boolean, remainingCredits: number }> {
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
				return this.returnSuccess(remainingCredits);
			}

			return this.returnFail(userId);
		} catch (error) {
			if (error && (error as Error & {errno?: number}).errno === ER_CONSTRAINT_FAILED_CODE) {
				return this.returnFail(userId);
			}

			throw error;
		}
	}

	returnSuccess (remainingCredits: number) {
		return { isConsumed: true, remainingCredits };
	}

	async returnFail (userId: string) {
		const result = await this.sql(CREDITS_TABLE).where({ user_id: userId }).select<[{amount: number}]>('amount');
		return { isConsumed: false, remainingCredits: result[0]?.amount || 0 };
	}
}

export const credits = new Credits(client);
