import type { Knex } from 'knex';
import Bluebird from 'bluebird';
import _ from 'lodash';
import config from 'config';
import { scopedLogger } from '../logger.js';
import type { fetchProbesWithAdminData as serverFetchProbesWithAdminData } from '../ws/server.js';
import type { Probe, ProbeLocation, Tag } from '../../probe/types.js';
import { normalizeFromPublicName } from '../geoip/utils.js';
import { getIndex } from '../location/location.js';
import { countries } from 'countries-list';

const logger = scopedLogger('adopted-probes');

export const ADOPTIONS_TABLE = 'gp_adopted_probes';
export const NOTIFICATIONS_TABLE = 'directus_notifications';

export type Adoption = {
	id: string;
	userId: string;
	ip: string;
	name: string | null;
	altIps: string[];
	uuid: string | null;
	lastSyncDate: Date;
	tags: {
		type: 'user';
		value: string;
	}[];
	systemTags: string[];
	isCustomCity: boolean;
	status: string;
	isIPv4Supported: boolean,
	isIPv6Supported: boolean,
	version: string | null;
	nodeVersion: string | null;
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

type Row = Omit<Adoption, 'isCustomCity' | 'tags' | 'systemTags' | 'altIps' | 'isIPv4Supported' | 'isIPv6Supported'> & {
	altIps: string;
	tags: string;
	systemTags: string;
	isCustomCity: number;
	isIPv4Supported: number;
	isIPv6Supported: number;
}

type AdoptionFieldDescription = {
	probeField: string,
	shouldUpdateIfCustomCity: boolean,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	formatter?: (probeValue: any) => unknown
}

export class AdoptedProbes {
	private adoptions: Adoption[] = [];
	private ipToAdoption: Map<string, Adoption> = new Map();
	private readonly adoptionFieldToProbeField: Partial<Record<keyof Adoption, AdoptionFieldDescription>> = {
		uuid: {
			probeField: 'uuid',
			shouldUpdateIfCustomCity: true,
		},
		ip: {
			probeField: 'ipAddress',
			shouldUpdateIfCustomCity: true,
		},
		altIps: {
			probeField: 'altIpAddresses',
			shouldUpdateIfCustomCity: true,
		},
		status: {
			probeField: 'status',
			shouldUpdateIfCustomCity: true,
		},
		isIPv4Supported: {
			probeField: 'isIPv4Supported',
			shouldUpdateIfCustomCity: true,
		},
		isIPv6Supported: {
			probeField: 'isIPv6Supported',
			shouldUpdateIfCustomCity: true,
		},
		version: {
			probeField: 'version',
			shouldUpdateIfCustomCity: true,
		},
		nodeVersion: {
			probeField: 'nodeVersion',
			shouldUpdateIfCustomCity: true,
		},
		hardwareDevice: {
			probeField: 'hardwareDevice',
			shouldUpdateIfCustomCity: true,
		},
		systemTags: {
			probeField: 'tags',
			shouldUpdateIfCustomCity: true,
			formatter: (probeTags: Tag[]) => probeTags.filter(({ type }) => type === 'system').map(({ value }) => value),
		},
		asn: {
			probeField: 'location.asn',
			shouldUpdateIfCustomCity: true,
		},
		network: {
			probeField: 'location.network',
			shouldUpdateIfCustomCity: true,
		},
		country: {
			probeField: 'location.country',
			shouldUpdateIfCustomCity: true,
		},
		city: {
			probeField: 'location.city',
			shouldUpdateIfCustomCity: false,
		},
		state: {
			probeField: 'location.state',
			shouldUpdateIfCustomCity: false,
		},
		latitude: {
			probeField: 'location.latitude',
			shouldUpdateIfCustomCity: false,
		},
		longitude: {
			probeField: 'location.longitude',
			shouldUpdateIfCustomCity: false,
		},
	};

	constructor (
		private readonly sql: Knex,
		private readonly fetchProbesWithAdminData: typeof serverFetchProbesWithAdminData,
	) {}

	getByIp (ip: string) {
		return this.ipToAdoption.get(ip);
	}

	getUpdatedLocation (probe: Probe): ProbeLocation | null {
		const adoption = this.getByIp(probe.ipAddress);

		if (!adoption || !adoption.isCustomCity || adoption.countryOfCustomCity !== probe.location.country) {
			return null;
		}

		return {
			...probe.location,
			city: adoption.city!,
			normalizedCity: normalizeFromPublicName(adoption.city!),
			state: adoption.state,
			latitude: adoption.latitude!,
			longitude: adoption.longitude!,
		};
	}

	getUpdatedTags (probe: Probe) {
		const adoption = this.getByIp(probe.ipAddress);

		if (!adoption || !adoption.tags.length) {
			return probe.tags;
		}

		return [
			...probe.tags,
			...adoption.tags,
		];
	}

	getUpdatedProbes (probes: Probe[]) {
		return probes.map((probe) => {
			const adoption = this.getByIp(probe.ipAddress);

			if (!adoption) {
				return probe;
			}

			const isCustomCity = adoption.isCustomCity;
			const hasUserTags = adoption.tags && adoption.tags.length;

			if (!isCustomCity && !hasUserTags) {
				return probe;
			}

			const newLocation = this.getUpdatedLocation(probe) || probe.location;

			const newTags = this.getUpdatedTags(probe);

			return {
				...probe,
				location: newLocation,
				tags: newTags,
				index: getIndex(newLocation, newTags),
			};
		});
	}

	scheduleSync () {
		setTimeout(() => {
			this.syncDashboardData()
				.finally(() => this.scheduleSync())
				.catch(error => logger.error(error));
		}, config.get<number>('adoptedProbes.syncInterval')).unref();
	}

	async syncDashboardData () {
		const [ probes ] = await Promise.all([
			this.fetchProbesWithAdminData(),
			this.fetchAdoptions(),
		]);

		const { adoptionsWithProbe, adoptionsWithoutProbe } = this.matchAdoptionsAndProbes(probes);
		const { updatedAdoptions, adoptionDataUpdates } = this.generateUpdatedAdoptions(adoptionsWithProbe, adoptionsWithoutProbe);
		const { adoptionsToDelete, adoptionAltIpUpdates } = this.findDuplications(updatedAdoptions);

		const adoptionUpdates = this.mergeUpdates(adoptionDataUpdates, adoptionAltIpUpdates, adoptionsToDelete);

		await this.resolveIfError(this.deleteAdoptions(adoptionsToDelete));
		await Bluebird.map(adoptionUpdates, ({ adoption, update }) => this.resolveIfError(this.updateAdoption(adoption, update)), { concurrency: 8 });
	}

	private async resolveIfError (pr: Promise<void>): Promise<void> {
		return pr.catch((e) => {
			logger.error(e);
		});
	}

	public async fetchAdoptions () {
		const rows = await this.sql(ADOPTIONS_TABLE)
			// First item will be preserved, so we are prioritizing online probes.
			// Sorting by id at the end so order is the same in any table state.
			.orderByRaw(`lastSyncDate DESC, onlineTimesToday DESC, FIELD(status, 'ready') DESC, id ASC`)
			.select<Row[]>();

		const adoptions: Adoption[] = rows.map(row => ({
			...row,
			altIps: JSON.parse(row.altIps) as string[],
			tags: (JSON.parse(row.tags) as { prefix: string; value: string; }[])
				.map(({ prefix, value }) => ({ type: 'user' as const, value: `u-${prefix}-${value}` })),
			systemTags: JSON.parse(row.systemTags) as string[],
			isCustomCity: Boolean(row.isCustomCity),
			isIPv4Supported: Boolean(row.isIPv4Supported),
			isIPv6Supported: Boolean(row.isIPv6Supported),
			latitude: row.latitude ? Math.round(row.latitude * 100) / 100 : row.latitude,
			longitude: row.longitude ? Math.round(row.longitude * 100) / 100 : row.longitude,
		}));

		this.adoptions = adoptions;

		this.ipToAdoption = new Map([
			...adoptions.map(adoption => [ adoption.ip, adoption ] as const),
			...adoptions.map(adoption => adoption.altIps.map(altIp => [ altIp, adoption ] as const)).flat(),
		]);
	}

	private matchAdoptionsAndProbes (probes: Probe[]) {
		const uuidToProbe = new Map(probes.map(probe => [ probe.uuid, probe ]));
		const ipToProbe = new Map(probes.map(probe => [ probe.ipAddress, probe ]));
		const altIpToProbe = new Map(probes.map(probe => probe.altIpAddresses.map(altIp => [ altIp, probe ] as const)).flat());
		const adoptionsWithProbe: { adoption: Adoption, probe: Probe }[] = [];

		// Searching probe for the adoption by: UUID.
		let adoptionsToCheck = [ ...this.adoptions ];
		let adoptionsWithoutProbe: Adoption[] = [];

		adoptionsToCheck.forEach((adoption) => {
			const probe = adoption.uuid && uuidToProbe.get(adoption.uuid);

			if (probe) {
				adoptionsWithProbe.push({ adoption, probe });
				uuidToProbe.delete(probe.uuid);
				ipToProbe.delete(probe.ipAddress);
				probe.altIpAddresses.forEach(altIp => altIpToProbe.delete(altIp));
			} else {
				adoptionsWithoutProbe.push(adoption);
			}
		});

		// Searching probe for the adoption by: adoption IP -> probe IP.
		adoptionsToCheck = [ ...adoptionsWithoutProbe ];
		adoptionsWithoutProbe = [];

		adoptionsToCheck.forEach((adoption) => {
			const probe = ipToProbe.get(adoption.ip);

			if (probe) {
				adoptionsWithProbe.push({ adoption, probe });
				uuidToProbe.delete(probe.uuid);
				ipToProbe.delete(probe.ipAddress);
				probe.altIpAddresses.forEach(altIp => altIpToProbe.delete(altIp));
			} else {
				adoptionsWithoutProbe.push(adoption);
			}
		});

		// Searching probe for the adoption by: adoption IP -> probe alt IP.
		adoptionsToCheck = [ ...adoptionsWithoutProbe ];
		adoptionsWithoutProbe = [];

		adoptionsToCheck.forEach((adoption) => {
			const probe = altIpToProbe.get(adoption.ip);

			if (probe) {
				adoptionsWithProbe.push({ adoption, probe });
				uuidToProbe.delete(probe.uuid);
				ipToProbe.delete(probe.ipAddress);
				probe.altIpAddresses.forEach(altIp => altIpToProbe.delete(altIp));
			} else {
				adoptionsWithoutProbe.push(adoption);
			}
		});

		// Searching probe for the adoption by: adoption alt IP -> probe IP or alt IP.
		adoptionsToCheck = [ ...adoptionsWithoutProbe ];
		adoptionsWithoutProbe = [];

		adoptionsToCheck.forEach((adoption) => {
			for (const altIp of adoption.altIps) {
				const probe = ipToProbe.get(altIp) || altIpToProbe.get(altIp);

				if (probe) {
					adoptionsWithProbe.push({ adoption, probe });
					uuidToProbe.delete(probe.uuid);
					ipToProbe.delete(probe.ipAddress);
					probe.altIpAddresses.forEach(altIp => altIpToProbe.delete(altIp));
					return;
				}
			}

			adoptionsWithoutProbe.push(adoption);
		});

		return { adoptionsWithProbe, adoptionsWithoutProbe };
	}

	private generateUpdatedAdoptions (adoptionsWithProbe: { adoption: Adoption, probe: Probe }[], adoptionsWithoutProbe: Adoption[]) {
		const adoptionDataUpdates: { adoption: Adoption, update: Partial<Adoption> }[] = [];
		const updatedAdoptions: Adoption[] = [];

		adoptionsWithProbe.forEach(({ adoption, probe }) => {
			const updateObject: Record<string, unknown> = {};

			Object.entries(this.adoptionFieldToProbeField).forEach(([ adoptionField, { probeField, shouldUpdateIfCustomCity, formatter }]) => {
				if (adoption.isCustomCity && !shouldUpdateIfCustomCity) {
					return;
				}

				const adoptionValue = _.get(adoption, adoptionField) as unknown;
				let probeValue = _.get(probe, probeField) as unknown;

				if (formatter) {
					probeValue = formatter(probeValue);
				}

				if (!_.isEqual(adoptionValue, probeValue)) {
					updateObject[adoptionField] = probeValue;
				}
			});

			if (!this.isToday(adoption.lastSyncDate)) {
				updateObject['lastSyncDate'] = new Date();
			}

			if (!_.isEmpty(updateObject)) {
				adoptionDataUpdates.push({ adoption, update: updateObject });
			}

			updatedAdoptions.push({ ...adoption, ...updateObject });
		});

		adoptionsWithoutProbe.forEach((adoption) => {
			const updateObject = {
				...(adoption.status !== 'offline' && { status: 'offline' }),
			};

			if (!_.isEmpty(updateObject)) {
				adoptionDataUpdates.push({ adoption, update: updateObject });
			}

			updatedAdoptions.push({ ...adoption, ...updateObject });
		});

		return { adoptionDataUpdates, updatedAdoptions };
	}

	private findDuplications (updatedAdoptions: Adoption[]) {
		const adoptionsToDelete: Adoption[] = [];
		const adoptionAltIpUpdates: { adoption: Adoption, update: { altIps: string[] } }[] = [];
		const uniqUuids = new Map<string, Adoption>();
		const uniqIps = new Map<string, Adoption>();

		updatedAdoptions.forEach((adoption) => {
			const existingAdoptionByUuid = adoption.uuid && uniqUuids.get(adoption.uuid);
			const existingAdoptionByIp = uniqIps.get(adoption.ip);
			const existingAdoption = existingAdoptionByUuid || existingAdoptionByIp;

			if (
				existingAdoption
				&& existingAdoption.country === adoption.country
				&& existingAdoption.userId === adoption.userId
			) {
				logger.warn(
					existingAdoptionByUuid ? `Duplication found by UUID: ${adoption.uuid}` : `Duplication found by IP: ${adoption.ip}`,
					{ stay: _.pick(existingAdoption, [ 'id', 'uuid', 'ip', 'altIps' ]), delete: _.pick(adoption, [ 'id', 'uuid', 'ip', 'altIps' ]) },
				);

				adoptionsToDelete.push(adoption);
				return;
			} else if (existingAdoption) {
				logger.error(
					existingAdoptionByUuid ? `Unremovable duplication found by UUID: ${adoption.uuid}` : `Unremovable duplication found by IP: ${adoption.ip}`,
					{ stay: _.pick(existingAdoption, [ 'id', 'uuid', 'ip', 'altIps' ]), duplicate: _.pick(adoption, [ 'id', 'uuid', 'ip', 'altIps' ]) },
				);
			}

			const duplicatedAltIps: string[] = [];
			const newAltIps: string[] = [];

			for (const altIp of adoption.altIps) {
				if (uniqIps.has(altIp)) {
					duplicatedAltIps.push(altIp);
				} else {
					newAltIps.push(altIp);
				}
			}

			if (duplicatedAltIps.length) {
				adoptionAltIpUpdates.push({ adoption, update: { altIps: newAltIps } });
			}

			adoption.uuid && uniqUuids.set(adoption.uuid, adoption);
			uniqIps.set(adoption.ip, adoption);
			newAltIps.forEach(altIp => uniqIps.set(altIp, adoption));
		});

		return { adoptionsToDelete, adoptionAltIpUpdates };
	}

	private mergeUpdates (
		adoptionDataUpdates: { adoption: Adoption; update: Partial<Adoption> }[],
		adoptionAltIpUpdates: { adoption: Adoption; update: { altIps: string[] } }[],
		adoptionsToDelete: Adoption[],
	): { adoption: Adoption; update: Partial<Adoption> }[] {
		const altIpUpdatesById = new Map(adoptionAltIpUpdates.map(altIpUpdate => [ altIpUpdate.adoption.id, altIpUpdate ]));

		const adoptionUpdates = adoptionDataUpdates.map((adoptionDataUpdate) => {
			const { adoption, update } = adoptionDataUpdate;
			const altIpUpdate = altIpUpdatesById.get(adoption.id);

			if (altIpUpdate) {
				altIpUpdatesById.delete(adoption.id);
				return { adoption, update: { ...update, ...altIpUpdate.update } };
			}

			return adoptionDataUpdate;
		});

		// Some of the altIpUpdatesById are merged with adoptionUpdates, others are included here.
		const allUpdates = [ ...adoptionUpdates, ...altIpUpdatesById.values() ];

		// Removing updates of probes that will be deleted.
		const deleteIds = adoptionsToDelete.map(({ id }) => id);
		const filteredUpdates = allUpdates.filter(({ adoption }) => !deleteIds.includes(adoption.id));
		return filteredUpdates;
	}

	private async updateAdoption (adoption: Adoption, update: Partial<Adoption>) {
		const formattedUpdate = Object.fromEntries(Object.entries(update).map(([ key, value ]) => [
			key, (_.isObject(value) && !_.isDate(value)) ? JSON.stringify(value) : value,
		]));

		console.log(`Updating id ${adoption.id}:`, formattedUpdate);
		await this.sql(ADOPTIONS_TABLE).where({ id: adoption.id }).update(formattedUpdate);

		// if country of probe changes, but there is a custom city in prev country, send notification to user.
		if (update.country) {
			if (adoption.countryOfCustomCity && adoption.country === adoption.countryOfCustomCity) {
				await this.sendNotificationCityNotApplied(adoption, update.country);
			} else if (adoption.countryOfCustomCity && update.country === adoption.countryOfCustomCity) {
				await this.sendNotificationCityAppliedAgain(adoption, update.country);
			}
		}
	}

	private async deleteAdoptions (adoptionsToDelete: Adoption[]) {
		if (adoptionsToDelete.length) {
			console.log('Deleting ids:', adoptionsToDelete.map(({ id }) => id));
			await this.sql(ADOPTIONS_TABLE).whereIn('id', adoptionsToDelete.map(({ id }) => id)).delete();
		}
	}

	private async sendNotification (recipient: string, subject: string, message: string) {
		await this.sql.raw(`
			INSERT INTO ${NOTIFICATIONS_TABLE} (recipient, subject, message) SELECT :recipient, :subject, :message
			WHERE NOT EXISTS (SELECT 1 FROM ${NOTIFICATIONS_TABLE} WHERE recipient = :recipient AND message = :message AND DATE(timestamp) = CURRENT_DATE)
		`, { recipient, subject, message });
	}

	private async sendNotificationCityNotApplied (adoption: Adoption, probeCountry: string) {
		const newCountry = countries[probeCountry as keyof typeof countries]?.name || probeCountry;
		const oldCountry = countries[adoption.country as keyof typeof countries]?.name || adoption.country;

		return this.sendNotification(
			adoption.userId,
			`Your probe's location has changed`,
			`Globalping detected that your ${adoption.name ? `probe [**${adoption.name}**](/probes/${adoption.id}) with IP address **${adoption.ip}**` : `[probe with IP address **${adoption.ip}**](/probes/${adoption.id})`} has changed its location from ${oldCountry} to ${newCountry}. The custom city value "${adoption.city}" is not applied anymore.\n\nIf this change is not right, please report it in [this issue](https://github.com/jsdelivr/globalping/issues/268).`,
		);
	}

	private async sendNotificationCityAppliedAgain (adoption: Adoption, probeCountry: string) {
		const newCountry = countries[probeCountry as keyof typeof countries]?.name || probeCountry;
		const oldCountry = countries[adoption.country as keyof typeof countries]?.name || adoption.country;

		return this.sendNotification(
			adoption.userId,
			`Your probe's location has changed back`,
			`Globalping detected that your ${adoption.name ? `probe [**${adoption.name}**](/probes/${adoption.id}) with IP address **${adoption.ip}**` : `[probe with IP address **${adoption.ip}**](/probes/${adoption.id})`} has changed its location back from ${oldCountry} to ${newCountry}. The custom city value "${adoption.city}" is now applied again.`,
		);
	}

	private isToday (date: Date) {
		const currentDate = new Date();
		return date.toDateString() === currentDate.toDateString();
	}
}
