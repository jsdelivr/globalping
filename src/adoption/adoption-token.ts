import type { Knex } from 'knex';
import { randomUUID } from 'crypto';
import { scopedLogger } from '../lib/logger.js';
import { client } from '../lib/sql/client.js';
import { Probe } from '../probe/types.js';

const USERS_TABLE = 'directus_users';
const PROBES_TABLE = 'gp_probes';
const NOTIFICATIONS_TABLE = 'directus_notifications';

const logger = scopedLogger('adoption-token');

type User = {
	id: string;
	adoption_token: string;
};

type DProbe = {
	id: string;
	name: string;
	ip: string;
	userId: string | null;
}

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

	async validate (token: string, probe: Probe) {
		let user = this.tokensToUsers.get(token);

		if (!user) {
			user = await this.fetchSpecificUser(token);
		}

		if (!user) {
			logger.info('User not found for the provided adoption token.', { token });
			return;
		}

		const dProbe = await this.fetchProbe(probe);

		if (dProbe && dProbe.userId === user.id) {
			return;
		}

		if (dProbe) {
			await this.adoptProbe(dProbe, probe, user);
		} else {
			await this.createProbe(probe, user);
		}
	}

	private async fetchProbe (probe: Probe) {
		const dProbe = await this.sql(PROBES_TABLE)
			.where({ uuid: probe.uuid })
			.orWhere({ ip: probe.ipAddress })
			.orWhereRaw('JSON_CONTAINS(altIps, ?)', [ probe.ipAddress ])
			.first<DProbe>();

		return dProbe;
	}

	private async adoptProbe (dProbe: DProbe, probe: Probe, user: User) {
		const name = await this.getDefaultProbeName(probe, user);

		await this.sql(PROBES_TABLE).where({ id: dProbe.id }).update({
			name,
			userId: user.id,
			tags: '[]',
			isCustomCity: false,
			countryOfCustomCity: null,
		});

		await this.sendNotificationProbeAdopted(dProbe.id, name, probe.ipAddress, user);

		if (dProbe.userId && dProbe.userId !== user.id) {
			await this.sendNotificationProbeUnassigned(dProbe);
		}
	}

	private async createProbe (probe: Probe, user: User) {
		const name = await this.getDefaultProbeName(probe, user);
		const newProbe = {
			id: randomUUID(),
			ip: probe.ipAddress,
			uuid: probe.uuid,
			name,
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
		await this.sendNotificationProbeAdopted(newProbe.id, newProbe.name, newProbe.ip, user);
	}

	private async sendNotificationProbeAdopted (id: string, name: string, ip: string, user: User) {
		await this.sendNotification(
			user.id,
			'New probe adopted',
			`New probe [**${name}**](/probes/${id}) with IP address **${ip}** was successfully assigned to your account.`,
		);
	}

	private async sendNotificationProbeUnassigned (dProbe: DProbe) {
		await this.sendNotification(
			dProbe.userId as string,
			'Probe was unassigned',
			`Your probe **${dProbe.name}** with IP address **${dProbe.ip}** was assigned to another account. That happened because probe specified adoption token of that account.`,
		);
	}

	private async sendNotification (recipient: string, subject: string, message: string) {
		await this.sql.raw(`
			INSERT INTO ${NOTIFICATIONS_TABLE} (recipient, subject, message) SELECT :recipient, :subject, :message
			WHERE NOT EXISTS (SELECT 1 FROM ${NOTIFICATIONS_TABLE} WHERE recipient = :recipient AND message = :message AND DATE(timestamp) = CURRENT_DATE)
		`, { recipient, subject, message });
	}

	private async getDefaultProbeName (probe: Probe, user: User) {
		let name = null;
		const namePrefix = `probe-${probe.location.country.toLowerCase().replaceAll(' ', '-')}-${probe.location.city.toLowerCase().replaceAll(' ', '-')}`;

		const result = await this.sql(PROBES_TABLE).where({
			userId: user.id,
			country: probe.location.country,
			city: probe.location.city,
		}).count<[{ count: number }]>({ count: '*' });
		name = `${namePrefix}-${(Number(result[0]!.count) + 1).toString().padStart(2, '0')}`;

		return name;
	}
}

export const adoptionToken = new AdoptionToken(client);
