import type { Knex } from 'knex';
import { scopedLogger } from '../lib/logger.js';
import { dashboardClient } from '../lib/sql/client.js';
import { SocketProbe } from '../probe/types.js';
import type { ServerSocket } from '../lib/ws/server.js';
import { AdoptedProbes } from '../lib/override/adopted-probes.js';
import got from 'got';
import config from 'config';

const PROBES_TABLE = 'gp_probes';

const logger = scopedLogger('adoption-token');
const directusUrl = config.get<string>('dashboard.directusUrl');
const systemKey = config.get<string>('systemApi.key');

type AccountToken = {
	accountId: string;
	token: string;
};

type DProbe = {
	id: string;
	name: string | null;
	ip: string | null;
	accountId: string | null;
};

const ACCOUNTS_TABLE = 'gp_accounts';
const ORGS_TABLE = 'gp_orgs';
const USERS_TABLE = 'directus_users';

export class AdoptionToken {
	private tokensToAccounts = new Map<string, string>();
	private timer: NodeJS.Timeout | undefined;

	constructor (
		private readonly sql: Knex,
		private readonly adoptedProbes: AdoptedProbes,
	) {}

	scheduleSync () {
		clearTimeout(this.timer);

		this.timer = setTimeout(() => {
			this.syncTokens()
				.finally(() => this.scheduleSync())
				.catch(error => logger.error('Error in AdoptionToken.syncTokens()', error));
		}, 60_000).unref();
	}

	unscheduleSync () {
		clearTimeout(this.timer);
	}

	async syncTokens () {
		const rows = await this.fetchTokens();
		this.tokensToAccounts = new Map(rows.map(row => ([ row.token, row.accountId ])));
	}

	private async fetchSpecificAccount (token: string) {
		const rows = await this.fetchTokens(token);
		const accountId = rows[0]?.accountId;

		if (!accountId) {
			return undefined;
		}

		this.tokensToAccounts.set(token, accountId);
		return accountId;
	}

	// Every adoption token is one of:
	// - directus_users.adoption_token
	// - gp_orgs.adoption_token
	// - gp_orgs.extra_adoption_tokens[*].token
	private async fetchTokens (token?: string) {
		const filterToken = (column: string) => (query: Knex.QueryBuilder) => {
			if (token) {
				query.where(column, token);
			} else {
				query.whereNotNull(column);
			}
		};

		const userTokens = this.sql(ACCOUNTS_TABLE)
			.join(USERS_TABLE, `${ACCOUNTS_TABLE}.user`, `${USERS_TABLE}.id`)
			.modify(filterToken(`${USERS_TABLE}.adoption_token`))
			.select(`${ACCOUNTS_TABLE}.id as accountId`, `${USERS_TABLE}.adoption_token as token`);

		const orgTokens = this.sql(ACCOUNTS_TABLE)
			.join(ORGS_TABLE, `${ACCOUNTS_TABLE}.org`, `${ORGS_TABLE}.id`)
			.modify(filterToken(`${ORGS_TABLE}.adoption_token`))
			.select(`${ACCOUNTS_TABLE}.id as accountId`, `${ORGS_TABLE}.adoption_token as token`);

		// The extracted column inherits the utf8mb4_bin collation of the JSON column, which does not union with the other two.
		const extraTokens = this.sql(ACCOUNTS_TABLE)
			.join(ORGS_TABLE, `${ACCOUNTS_TABLE}.org`, `${ORGS_TABLE}.id`)
			.joinRaw(`, JSON_TABLE(${ORGS_TABLE}.extra_adoption_tokens, '$[*]' COLUMNS (token VARCHAR(255) PATH '$.token')) t`)
			.modify((query) => {
				if (token) {
					query.whereRaw('t.token = ?', [ token ]);
				}
			})
			.select(`${ACCOUNTS_TABLE}.id as accountId`, this.sql.raw('t.token COLLATE utf8mb4_unicode_ci as token'));

		return userTokens.unionAll([ orgTokens, extraTokens ]) as unknown as Promise<AccountToken[]>;
	}

	async validate (socket: ServerSocket) {
		const probe = socket.data.probe;
		const isAdopted = !!this.adoptedProbes.getByIp(probe.ipAddress)?.accountId;

		if (!probe.adoptionToken) {
			!isAdopted && socket.emit('api:connect:adoption', { message: 'You can register this probe at https://dash.globalping.io to earn extra measurement credits.', adopted: false });
			return;
		}

		const validationResult = await this.validateToken(probe.adoptionToken, probe);

		if (validationResult.message) {
			socket.emit('api:connect:adoption', validationResult);
		}
	}

	async getAccountByToken (token: string) {
		let accountId = this.tokensToAccounts.get(token);

		if (!accountId) {
			accountId = await this.fetchSpecificAccount(token);
		}

		return accountId;
	}

	getAccountIdByToken (token: string): string | null {
		return this.tokensToAccounts.get(token) ?? null;
	}

	async validateToken (token: string, probe: SocketProbe): Promise<{ message: string | null; level?: 'info' | 'warn'; adopted: boolean }> {
		const accountId = await this.getAccountByToken(token);

		if (!accountId) {
			logger.info('User not found for the provided adoption token.', { token });
			return { message: `User not found for the provided adoption token: ${token}.`, level: 'warn', adopted: false };
		}

		let dProbe: DProbe | null = this.adoptedProbes.getByIp(probe.ipAddress) || this.adoptedProbes.getByUuid(probe.uuid);

		if (!dProbe || dProbe.accountId !== accountId) {
			dProbe = await this.fetchDProbe(probe);
		}

		if (dProbe && dProbe.accountId === accountId) {
			return { message: null, adopted: true };
		}

		await this.adoptProbe(probe, accountId);

		return { message: 'Probe successfully adopted by token.', adopted: true };
	}

	private async fetchDProbe (probe: SocketProbe) {
		const dProbe = await this.sql(PROBES_TABLE)
			.where({ uuid: probe.uuid })
			.orWhere({ ip: probe.ipAddress })
			.orWhereRaw('JSON_CONTAINS(altIps, ?)', [ probe.ipAddress ])
			.first<DProbe | undefined>([ 'id', 'name', 'ip', 'account_id as accountId' ]);

		return dProbe || null;
	}

	private async adoptProbe (probe: SocketProbe, accountId: string) {
		await got.put(`${directusUrl}/adoption-code/adopt-by-token`, {
			json: {
				probe: AdoptedProbes.formatProbeAsDProbe(probe),
				account: {
					id: accountId,
				},
			},
			headers: {
				Authorization: `Bearer ${systemKey}`,
			},
			timeout: {
				request: 5000,
			},
			retry: {
				limit: 2,
			},
		});
	}
}

export const initAdoptionToken = (adoptedProbes: AdoptedProbes) => {
	return new AdoptionToken(dashboardClient, adoptedProbes);
};
