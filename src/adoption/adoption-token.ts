import type { Knex } from 'knex';
import { scopedLogger } from '../lib/logger.js';
import { client } from '../lib/sql/client.js';
import { Probe } from '../probe/types.js';
import { ServerSocket, adoptedProbes } from '../lib/ws/server.js';
import { AdoptedProbes } from '../lib/override/adopted-probes.js';
import got from 'got';
import config from 'config';

const USERS_TABLE = 'directus_users';
const PROBES_TABLE = 'gp_probes';

const logger = scopedLogger('adoption-token');
const directusUrl = config.get<string>('dashboard.directusUrl');
const systemKey = config.get<string>('systemApi.key');

type User = {
	id: string;
	adoption_token: string;
};

type DProbe = {
	id: string;
	name: string | null;
	ip: string;
	userId: string | null;
}

export class AdoptionToken {
	private tokensToUsers = new Map<string, User>();
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
		const users = await this.fetchUsers();
		this.tokensToUsers = new Map(users.map(user => ([ user.adoption_token, user ])));
	}

	private async fetchSpecificUser (token: string) {
		const users = await this.fetchUsers({ adoption_token: token });

		if (users.length === 0) {
			return undefined;
		}

		const user = users[0]!;

		this.tokensToUsers.set(user.adoption_token, user);
		return user;
	}

	private async fetchUsers (filter: Record<string, unknown> = {}) {
		const users = await this.sql(USERS_TABLE)
			.where(filter)
			.select<User[]>([ 'id', 'adoption_token' ]);
		return users;
	}

	async validate (socket: ServerSocket) {
		const tokenValue = socket.handshake.query['adoptionToken'];
		const token = !tokenValue ? null : String(tokenValue);
		const probe = socket.data.probe;
		const isAdopted = !!this.adoptedProbes.getByIp(probe.ipAddress);

		if (!token) {
			!isAdopted && socket.emit('api:connect:adoption', { message: 'You can register this probe at https://dash.globalping.io to earn extra measurement credits.' });
			return;
		}

		const { message, level } = await this.validateToken(token, probe);

		if (message) {
			socket.emit('api:connect:adoption', { message, level });
		}
	}

	async getUserByToken (token: string) {
		let user = this.tokensToUsers.get(token);

		if (!user) {
			user = await this.fetchSpecificUser(token);
		}

		return user;
	}

	async validateToken (token: string, probe: Probe): Promise<{ message: string | null, level?: 'info' | 'warn' }> {
		const user = await this.getUserByToken(token);

		if (!user) {
			logger.info('User not found for the provided adoption token.', { token });
			return { message: `User not found for the provided adoption token: ${token}.`, level: 'warn' };
		}

		let dProbe: DProbe | null = this.adoptedProbes.getByIp(probe.ipAddress) || this.adoptedProbes.getByUuid(probe.uuid);

		if (!dProbe || dProbe.userId !== user.id) {
			dProbe = await this.fetchProbe(probe);
		}

		if (dProbe && dProbe.userId === user.id) {
			return { message: null };
		}

		await this.adoptProbe(probe, user);

		return { message: 'Probe successfully adopted by token.' };
	}

	private async fetchProbe (probe: Probe) {
		const dProbe = await this.sql(PROBES_TABLE)
			.where({ uuid: probe.uuid })
			.orWhere({ ip: probe.ipAddress })
			.orWhereRaw('JSON_CONTAINS(altIps, ?)', [ probe.ipAddress ])
			.first<DProbe>();

		return dProbe;
	}

	private async adoptProbe (probe: Probe, user: User) {
		await got.put(`${directusUrl}/adoption-code/adopt-by-token`, {
			json: {
				probe: AdoptedProbes.formatProbeAsDProbe(probe),
				user: {
					id: user.id,
				},
			},
			headers: {
				'X-Api-Key': systemKey,
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

export const adoptionToken = new AdoptionToken(client, adoptedProbes);
