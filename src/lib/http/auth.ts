import { createHash } from 'node:crypto';
import type { Knex } from 'knex';
import TTLCache from '@isaacs/ttlcache';
import { base32 } from '@scure/base';
import { scopedLogger } from '../logger.js';
import { client } from '../sql/client.js';

export const GP_TOKENS_TABLE = 'gp_tokens';
export const USERS_TABLE = 'directus_users';

const logger = scopedLogger('auth');

const TOKEN_TTL = 2 * 60 * 1000;

export type Token = {
	user_created: string | null,
	user_github_username: string | null,
	value: string,
	expire: Date | null,
	scopes: string[],
	origins: string[],
	date_last_used: Date | null,
	type: 'access_token' | 'refresh_token',
}

type Row = Omit<Token, 'scopes' | 'origins'> & {
	scopes: string | null,
	origins: string | null,
}

export class Auth {
	private validTokens = new TTLCache<string, Token>({ ttl: TOKEN_TTL });
	private invalidTokens = new TTLCache<string, true>({ ttl: TOKEN_TTL });
	private timer: NodeJS.Timeout | undefined;

	constructor (private readonly sql: Knex) {}

	scheduleSync () {
		clearTimeout(this.timer);

		this.timer = setTimeout(() => {
			this.syncTokens()
				.finally(() => this.scheduleSync())
				.catch(error => logger.error('Error in Auth.syncTokens()', error));
		}, 60_000).unref();
	}

	unscheduleSync () {
		clearTimeout(this.timer);
	}

	async syncTokens () {
		const tokens = await this.fetchTokens({ type: 'access_token' });
		const newValidTokens = new TTLCache<string, Token>({ ttl: TOKEN_TTL });
		const newInvalidTokens = new TTLCache<string, true>({ ttl: TOKEN_TTL });

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
		const tokens = await this.fetchTokens({ type: 'access_token', value: hash });

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
		const rows = await this.sql(GP_TOKENS_TABLE)
			.leftJoin(USERS_TABLE, 'user_created', `${USERS_TABLE}.id`)
			.where(filter)
			.select<Row[]>([ 'user_created', 'value', 'expire', 'origins', 'date_last_used', 'scopes', 'github_username as user_github_username' ]);

		const tokens: Token[] = rows.map(row => ({
			...row,
			scopes: (row.scopes ? JSON.parse(row.scopes) as string[] : []),
			origins: (row.origins ? JSON.parse(row.origins) as string[] : []),
		}));

		return tokens;
	}

	async validate (tokenString: string, origin: string) {
		let bytes;

		try {
			bytes = base32.decode(tokenString.toUpperCase());
		} catch {
			return null;
		}

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
		return { userId: token.user_created, username: token.user_github_username, scopes: token.scopes, hashedToken: token.value };
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
