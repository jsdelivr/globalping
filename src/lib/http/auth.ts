import { createHash } from 'node:crypto';
import type { Knex } from 'knex';
import TTLCache from '@isaacs/ttlcache';
import { scopedLogger } from '../logger.js';
import { client } from '../sql/client.js';

export const GP_TOKENS_TABLE = 'gp_tokens';
export const USERS_TABLE = 'directus_users';

const logger = scopedLogger('auth');

export type Token = {
	user_created: string,
	value: string,
	expire: Date | null,
	origins: string[],
	date_last_used: Date | null
}

type Row = Omit<Token, 'origins'> & {
	origins: string | null,
}

export class Auth {
	private validTokens = new TTLCache<string, Token>({ ttl: 2 * 60 * 1000 });
	private invalidTokens = new TTLCache<string, true>({ ttl: 2 * 60 * 1000 });
	constructor (private readonly sql: Knex) {}

	scheduleSync () {
		setTimeout(() => {
			this.syncTokens()
				.finally(() => this.scheduleSync())
				.catch(error => logger.error(error));
		}, 60_000);
	}

	async syncTokens () {
		const tokens = await this.fetchTokens();
		const newValidTokens = new TTLCache<string, Token>({ ttl: 2 * 60 * 1000 });
		const newInvalidTokens = new TTLCache<string, true>({ ttl: 2 * 60 * 1000 });

		tokens.forEach((token) => {
			if (token.expire && this.isExpired(token.expire)) {
				newInvalidTokens.set(token.value, true);
			} else {
				newValidTokens.set(token.value, token);
			}
		});

		this.validTokens = newValidTokens;
		this.invalidTokens = newInvalidTokens;
	}

	async syncSpecificToken (hash: string) {
		const tokens = await this.fetchTokens({ value: hash });

		if (tokens.length === 0) {
			this.invalidTokens.set(hash, true);
			return undefined;
		}

		const token = tokens[0]!;

		if (token.expire && this.isExpired(token.expire)) {
			this.invalidTokens.set(hash, true);
			return undefined;
		}

		this.validTokens.set(hash, token);
		return token;
	}

	async fetchTokens (filter: Partial<Row> = {}) {
		const rows = await this.sql(GP_TOKENS_TABLE).where(filter)
			.select<Row[]>([ 'user_created', 'value', 'expire', 'origins', 'date_last_used' ]);

		const tokens: Token[] = rows.map(row => ({
			...row,
			origins: (row.origins ? JSON.parse(row.origins) as string[] : []),
		}));

		return tokens;
	}

	async validate (tokenString: string, origin: string) {
		const bytes = Buffer.from(tokenString, 'base64');
		const hash = createHash('sha256').update(bytes).digest('base64');

		if (this.invalidTokens.get(hash)) {
			return null;
		}

		let token = this.validTokens.get(hash);

		if (!token) {
			token = await this.syncSpecificToken(hash);
		}

		if (!token) {
			return null;
		}

		if (!this.isValidOrigin(origin, token.origins)) {
			return null;
		}

		await this.updateLastUsedDate(token);
		return token.user_created;
	}

	private async updateLastUsedDate (token: Token) {
		if (!token.date_last_used || !this.isToday(token.date_last_used)) {
			const date = new Date();
			await this.sql(GP_TOKENS_TABLE).where({ value: token.value }).update({ date_last_used: date });
			token.date_last_used = date;
		}
	}

	private isExpired (date: Date) {
		const currentDate = new Date();
		currentDate.setHours(0, 0, 0, 0);
		return date < currentDate;
	}

	private isValidOrigin (origin: string, validOrigins: string[]) {
		return validOrigins.length > 0 ? validOrigins.includes(origin) : true;
	}

	private isToday (date: Date) {
		const currentDate = new Date();
		return date.toDateString() === currentDate.toDateString();
	}
}

export const auth = new Auth(client);
