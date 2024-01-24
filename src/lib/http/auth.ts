import type { Knex } from 'knex';
import { client } from '../sql/client.js';

export class Auth {
	constructor (private readonly sql: Knex) {}

	async validate (token: string) {
		return true;
	}
}

export const auth = new Auth(client);
