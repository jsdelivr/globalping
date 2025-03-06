import type { Knex } from 'knex';
import { scopedLogger } from '../lib/logger.js';
import { client } from '../lib/sql/client.js';

const USERS_TABLE = 'directus_users';
const PROBES_TABLE = 'gp_probes';

const logger = scopedLogger('adoption-token');

type User = {
	id: string;
	adoption_token: string;
};

export class AdoptionToken {
	private tokensToUsers = new Map<string, User>();
	private timer: NodeJS.Timeout | undefined;

	constructor (private readonly sql: Knex) {}

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

	async fetchSpecificUser (token: string) {
		const users = await this.fetchUsers({ adoption_token: token });

		if (users.length === 0) {
			return undefined;
		}

		const user = users[0]!;

		this.tokensToUsers.set(user.adoption_token, user);
		return user;
	}

	async fetchUsers (filter: Record<string, unknown> = {}) {
		const users = await this.sql(USERS_TABLE)
			.where(filter)
			.select<User[]>([ 'id', 'adoption_token' ]);
		return users;
	}

	async validate (token: string, ip: string) {
		let user = this.tokensToUsers.get(token);

		if (!user) {
			user = await this.fetchSpecificUser(token);
		}

		if (!user) {
			logger.info('User not found for the provided adoption token.', { token });
			return;
		}

		await this.adoptProbe(ip, user);
	}

	async adoptProbe (ip: string, user: User) {
		await this.sql(PROBES_TABLE).where({ ip }).update({ userId: user.id });
	}
}

export const adoptionToken = new AdoptionToken(client);
