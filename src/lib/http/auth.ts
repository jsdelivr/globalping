import { createHash } from 'node:crypto';
import type { Knex } from 'knex';
import TTLCache from '@isaacs/ttlcache';
import { scopedLogger } from '../logger.js';
import { client } from '../sql/client.js';

export const GP_TOKENS_TABLE = 'gp_tokens';

const logger = scopedLogger('auth');

type Token = {
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
		tokens.forEach((token) => {
			if (token.expire && this.isExpired(token.expire)) {
				this.invalidTokens.set(token.value, true);
			} else {
				this.validTokens.set(token.value, token);
			}
		});
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
		const rows = await this.sql(GP_TOKENS_TABLE).select<Row[]>('value', 'expire', 'origins', 'date_last_used').where(filter);

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
			return false;
		}

		let token = this.validTokens.get(hash);

		if (!token) {
			token = await this.syncSpecificToken(hash);
		}

		if (!token) {
			return false;
		}

		if (!this.isValidOrigin(origin, token.origins)) {
			return false;
		}

		return true;
	}

	private isExpired (date: Date) {
		const currentDate = new Date();
		currentDate.setHours(0, 0, 0, 0);
		return date < currentDate;
	}

	private isValidOrigin (origin: string, validOrigins: string[]) {
		return validOrigins.length > 0 ? validOrigins.includes(origin) : true;
	}
}

export const auth = new Auth(client);
