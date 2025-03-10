import type { Knex } from 'knex';
import { randomUUID } from 'crypto';
import { scopedLogger } from '../lib/logger.js';
import { client } from '../lib/sql/client.js';
import { Probe } from '../probe/types.js';

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

	async validate (token: string, probe: Probe) {
		let user = this.tokensToUsers.get(token);

		if (!user) {
			user = await this.fetchSpecificUser(token);
		}

		if (!user) {
			logger.info('User not found for the provided adoption token.', { token });
			return;
		}

		// Check here if user.id is equal to adoptedProbes.getByIp(probe.ipAddress).userId. If it is the same user => do nothing.

		await this.adoptProbe(probe, user);
	}

	async adoptProbe (probe: Probe, user: User) {
		const numberOfUpdates = await this.sql(PROBES_TABLE).where({ ip: probe.ipAddress }).orWhere({ uuid: probe.uuid, userId: null }).update({ userId: user.id });

		if (numberOfUpdates === 0) {
			await this.createProbe(probe, user);
		}
	}

	async createProbe (probe: Probe, user: User) {
		const newProbe = {
			id: randomUUID(),
			ip: probe.ipAddress,
			uuid: probe.uuid,
			name: await this.getDefaultProbeName(probe, user),
			version: probe.version,
			nodeVersion: probe.nodeVersion,
			hardwareDevice: probe.hardwareDevice,
			hardwareDeviceFirmware: probe.hardwareDeviceFirmware,
			status: probe.status,
			city: probe.location.city,
			state: probe.location.state,
			country: probe.location.country,
			latitude: probe.location.latitude,
			longitude: probe.location.longitude,
			asn: probe.location.asn,
			network: probe.location.network,
			userId: user.id,
			lastSyncDate: new Date(),
			isIPv4Supported: probe.isIPv4Supported,
			isIPv6Supported: probe.isIPv6Supported,
		};
		await this.sql(PROBES_TABLE).insert(newProbe);
	}

	async getDefaultProbeName (probe: Probe, user: User) {
		let name = null;
		const namePrefix = probe.location.country && probe.location.city ? `probe-${probe.location.country.toLowerCase().replaceAll(' ', '-')}-${probe.location.city.toLowerCase().replaceAll(' ', '-')}` : null;

		if (namePrefix) {
			const result = await this.sql(PROBES_TABLE).where({
				userId: user.id,
				country: probe.location.country,
				city: probe.location.city,
			}).count<[{ count: number }]>({ count: '*' });
			name = `${namePrefix}-${(Number(result[0]?.count) + 1).toString().padStart(2, '0')}`;
		}

		return name;
	}
}

export const adoptionToken = new AdoptionToken(client);
