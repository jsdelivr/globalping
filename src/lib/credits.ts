import type { Knex } from 'knex';
import { client } from './sql/client.js';

const CREDITS_TABLE = 'gp_credits';
const ER_CONSTRAINT_FAILED_CODE = 4025;

export class Credits {
	constructor (private readonly sql: Knex) {}

	async consume (userId: string, credits: number) {
		try {
			await this.sql(CREDITS_TABLE).where({ user_id: userId }).update({ amount: this.sql.raw('amount - ?', [ credits ]) });
		} catch (error) {
			if (error && (error as Error & {errno?: number}).errno === ER_CONSTRAINT_FAILED_CODE) {
				return false;
			}

			throw error;
		}

		return true;
	}
}

export const credits = new Credits(client);
