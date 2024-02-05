import type { Knex } from 'knex';
import { client } from './sql/client.js';

const CREDITS_TABLE = 'gp_credits';
const ER_CONSTRAINT_FAILED_CODE = 4025;

export class Credits {
	constructor (private readonly sql: Knex) {}

	async consume (userId: string, credits: number) {
		try {
			const result = await this.sql(CREDITS_TABLE).where({ user_id: userId }).update({ amount: this.sql.raw('amount - ?', [ credits ]) });

			if (result === 1) {
				return true;
			}
		} catch (error) {
			if (error && (error as Error & {errno?: number}).errno === ER_CONSTRAINT_FAILED_CODE) {
				return false;
			}

			throw error;
		}

		return false;
	}
}

export const credits = new Credits(client);
