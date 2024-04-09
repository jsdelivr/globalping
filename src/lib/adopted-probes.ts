import type { Knex } from 'knex';
import Bluebird from 'bluebird';
import _ from 'lodash';
import { scopedLogger } from './logger.js';
import type { fetchProbesWithAdminData as serverFetchProbesWithAdminData } from './ws/server.js';
import type { Probe, ProbeLocation } from '../probe/types.js';
import { normalizeFromPublicName } from './geoip/utils.js';
import { getIndex } from '../probe/builder.js';

const logger = scopedLogger('adopted-probes');

export const ADOPTED_PROBES_TABLE = 'gp_adopted_probes';
export const NOTIFICATIONS_TABLE = 'directus_notifications';

export type AdoptedProbe = {
	userId: string;
	ip: string;
	uuid: string | null;
	lastSyncDate: Date;
	tags: {
		type: 'user';
		value: string;
	}[];
	isCustomCity: boolean;
	status: string;
	version: string | null;
	hardwareDevice: string | null;
	country: string | null;
	countryOfCustomCity: string | null;
	city: string | null;
	state: string | null;
	latitude: number | null;
	longitude: number | null;
	asn: number | null;
	network: string | null;
}

type Row = Omit<AdoptedProbe, 'isCustomCity' | 'tags'> & {
	tags: string;
	isCustomCity: number;
}

export class AdoptedProbes {
	private connectedIpToProbe: Map<string, Probe> = new Map();
	private connectedUuidToIp: Map<string, string> = new Map();
	private adoptedIpToProbe: Map<string, AdoptedProbe> = new Map();
	private readonly adoptedFieldToConnectedField = {
		status: {
			connectedField: 'status',
			shouldUpdateIfCustomCity: true,
		},
		version: {
			connectedField: 'version',
			shouldUpdateIfCustomCity: true,
		},
		hardwareDevice: {
			connectedField: 'hardwareDevice',
			shouldUpdateIfCustomCity: true,
		},
		asn: {
			connectedField: 'location.asn',
			shouldUpdateIfCustomCity: true,
		},
		network: {
			connectedField: 'location.network',
			shouldUpdateIfCustomCity: true,
		},
		country: {
			connectedField: 'location.country',
			shouldUpdateIfCustomCity: true,
		},
		city: {
			connectedField: 'location.city',
			shouldUpdateIfCustomCity: false,
		},
		state: {
			connectedField: 'location.state',
			shouldUpdateIfCustomCity: false,
		},
		latitude: {
			connectedField: 'location.latitude',
			shouldUpdateIfCustomCity: false,
		},
		longitude: {
			connectedField: 'location.longitude',
			shouldUpdateIfCustomCity: false,
		},
	};

	constructor (
		private readonly sql: Knex,
		private readonly fetchProbesWithAdminData: typeof serverFetchProbesWithAdminData,
	) {}

	getByIp (ip: string) {
		return this.adoptedIpToProbe.get(ip);
	}

	getUpdatedLocation (probe: Probe): ProbeLocation | null {
		const adoptedProbe = this.getByIp(probe.ipAddress);

		if (!adoptedProbe || !adoptedProbe.isCustomCity || adoptedProbe.countryOfCustomCity !== probe.location.country) {
			return null;
		}

		return {
			...probe.location,
			city: adoptedProbe.city!,
			normalizedCity: normalizeFromPublicName(adoptedProbe.city!),
			...(adoptedProbe.state && { state: adoptedProbe.state }),
			latitude: adoptedProbe.latitude!,
			longitude: adoptedProbe.longitude!,
		};
	}

	getUpdatedTags (probe: Probe) {
		const adoptedProbe = this.getByIp(probe.ipAddress);

		if (!adoptedProbe || !adoptedProbe.tags.length) {
			return probe.tags;
		}

		return [
			...probe.tags,
			...adoptedProbe.tags,
		];
	}

	getUpdatedProbes (probes: Probe[]) {
		return probes.map((probe) => {
			const adopted = this.getByIp(probe.ipAddress);

			if (!adopted) {
				return probe;
			}

			const isCustomCity = adopted.isCustomCity;
			const hasUserTags = adopted.tags && adopted.tags.length;

			if (!isCustomCity && !hasUserTags) {
				return probe;
			}

			const newLocation = this.getUpdatedLocation(probe);

			const newTags = this.getUpdatedTags(probe);

			return {
				...probe,
				location: newLocation,
				tags: newTags,
				index: getIndex(newLocation || probe.location, newTags),
			};
		});
	}

	scheduleSync () {
		setTimeout(() => {
			this.syncDashboardData()
				.finally(() => this.scheduleSync())
				.catch(error => logger.error(error));
		}, 60_000).unref();
	}

	async syncDashboardData () {
		const allProbes = await this.fetchProbesWithAdminData();
		this.connectedIpToProbe = new Map(allProbes.map(probe => [ probe.ipAddress, probe ]));
		this.connectedUuidToIp = new Map(allProbes.map(probe => [ probe.uuid, probe.ipAddress ]));

		await this.fetchAdoptedProbes();
		await Bluebird.map(this.adoptedIpToProbe.values(), ({ ip, uuid }) => this.syncProbeIds(ip, uuid), { concurrency: 8 });
		await Bluebird.map(this.adoptedIpToProbe.values(), adoptedProbe => this.syncProbeData(adoptedProbe), { concurrency: 8 });
		await Bluebird.map(this.adoptedIpToProbe.values(), ({ ip, lastSyncDate }) => this.updateSyncDate(ip, lastSyncDate), { concurrency: 8 });
	}

	private async fetchAdoptedProbes () {
		const rows = await this.sql(ADOPTED_PROBES_TABLE).select<Row[]>();


		const adoptedProbes: AdoptedProbe[] = rows.map(row => ({
			...row,
			tags: (row.tags ? JSON.parse(row.tags) as {prefix: string; value: string;}[] : [])
				.map(({ prefix, value }) => ({ type: 'user' as const, value: `u-${prefix}-${value}` })),
			isCustomCity: Boolean(row.isCustomCity),
		}));

		this.adoptedIpToProbe = new Map(adoptedProbes.map(probe => [ probe.ip, probe ]));
	}

	private async syncProbeIds (ip: string, uuid: string | null) {
		const connectedProbe = this.connectedIpToProbe.get(ip);

		if (connectedProbe && connectedProbe.uuid === uuid) { // ip and uuid are synced
			return;
		}

		if (connectedProbe && connectedProbe.uuid !== uuid) { // uuid was found, but it is outdated
			await this.updateUuid(ip, connectedProbe.uuid);
			return;
		}

		if (!uuid) { // uuid is null, so no searching by uuid is required
			return;
		}

		const connectedIp = this.connectedUuidToIp.get(uuid);

		if (connectedIp) { // data was found by uuid, but not found by ip, therefore ip is outdated
			await this.updateIp(connectedIp, uuid);
		}
	}

	private async syncProbeData (adoptedProbe: AdoptedProbe) {
		const connectedProbe = this.connectedIpToProbe.get(adoptedProbe.ip);
		const isCustomCity = adoptedProbe.isCustomCity;

		if (!connectedProbe && adoptedProbe.status !== 'offline') {
			await this.updateProbeData(adoptedProbe, { status: 'offline' });
			return;
		}

		if (!connectedProbe) {
			return;
		}

		const updateObject: Record<string, string | number> = {};

		Object.entries(this.adoptedFieldToConnectedField).forEach(([ adoptedField, { connectedField, shouldUpdateIfCustomCity }]) => {
			if (isCustomCity && !shouldUpdateIfCustomCity) {
				return;
			}

			const adoptedValue = _.get(adoptedProbe, adoptedField) as string | number;
			const connectedValue = _.get(connectedProbe, connectedField) as string | number;

			if (adoptedValue !== connectedValue) {
				updateObject[adoptedField] = connectedValue;
			}
		});

		// if country of probe changes, but there is a custom city in prev country, send notification to user
		if (updateObject['country'] && adoptedProbe.countryOfCustomCity && adoptedProbe.country === adoptedProbe.countryOfCustomCity) {
			await this.sendNotification(adoptedProbe, connectedProbe);
		}

		if (!_.isEmpty(updateObject)) {
			await this.updateProbeData(adoptedProbe, updateObject);
		}
	}

	private async updateSyncDate (ip: string, lastSyncDate: Date) {
		if (this.isToday(lastSyncDate)) { // date is already synced
			return;
		}

		const probeIsConnected = this.connectedIpToProbe.has(ip);

		if (probeIsConnected) { // date is old, but probe is connected, therefore updating the sync date
			await this.updateLastSyncDate(ip);
			return;
		}

		if (this.isMoreThan30DaysAgo(lastSyncDate)) { // probe wasn't connected for >30 days, removing adoption
			await this.deleteAdoptedProbe(ip);
		}
	}

	private async updateUuid (ip: string, uuid: string) {
		await this.sql(ADOPTED_PROBES_TABLE).where({ ip }).update({ uuid });
		const adoptedProbe = this.adoptedIpToProbe.get(ip);

		if (adoptedProbe) { adoptedProbe.uuid = uuid; }
	}

	private async updateIp (ip: string, uuid: string) {
		await this.sql(ADOPTED_PROBES_TABLE).where({ uuid }).update({ ip });
		const entry = [ ...this.adoptedIpToProbe.entries() ].find(([ , adoptedProbe ]) => adoptedProbe.uuid === uuid);

		if (entry) {
			const [ prevIp, adoptedProbe ] = entry;
			adoptedProbe.ip = ip;
			this.adoptedIpToProbe.delete(prevIp);
			this.adoptedIpToProbe.set(ip, adoptedProbe);
		}
	}

	private async updateProbeData (adoptedProbe: AdoptedProbe, updateObject: Record<string, string | number>) {
		await this.sql(ADOPTED_PROBES_TABLE).where({ ip: adoptedProbe.ip }).update(updateObject);

		for (const [ field, value ] of Object.entries(updateObject)) {
			(adoptedProbe as unknown as Record<string, string | number>)[field] = value;
		}
	}

	private async updateLastSyncDate (ip: string) {
		const date = new Date();
		await this.sql(ADOPTED_PROBES_TABLE).where({ ip }).update({ lastSyncDate: date });
		const adoptedProbe = this.adoptedIpToProbe.get(ip);

		if (adoptedProbe) {
			adoptedProbe.lastSyncDate = date;
		}
	}

	private async deleteAdoptedProbe (ip: string) {
		await this.sql(ADOPTED_PROBES_TABLE).where({ ip }).delete();
		this.adoptedIpToProbe.delete(ip);
	}

	private async sendNotification (adoptedProbe: AdoptedProbe, connectedProbe: Probe) {
		await this.sql.raw(`
			INSERT INTO ${NOTIFICATIONS_TABLE} (recipient, subject, message) SELECT :recipient, :subject, :message
			WHERE NOT EXISTS (SELECT 1 FROM ${NOTIFICATIONS_TABLE} WHERE recipient = :recipient AND message = :message AND DATE(timestamp) = CURRENT_DATE)
		`, {
			recipient: adoptedProbe.userId,
			subject: 'Adopted probe country change',
			message: `Globalping API detected that your adopted probe with ip: ${adoptedProbe.ip} is located at "${connectedProbe.location.country}". So its country value changed from "${adoptedProbe.country}" to "${connectedProbe.location.country}", and custom city value "${adoptedProbe.city}" is not applied right now.\n\nIf this change is not right please report in [that issue](https://github.com/jsdelivr/globalping/issues/268).`,
		});
	}

	private isToday (date: Date) {
		const currentDate = new Date();
		return date.toDateString() === currentDate.toDateString();
	}

	private isMoreThan30DaysAgo (date: Date) {
		const currentDate = new Date();

		const timeDifference = currentDate.getTime() - date.getTime();
		const daysDifference = timeDifference / (24 * 3600 * 1000);

		return daysDifference > 30;
	}
}
