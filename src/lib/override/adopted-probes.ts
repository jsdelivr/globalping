import type { Knex } from 'knex';
import Bluebird from 'bluebird';
import _ from 'lodash';
import config from 'config';
import { scopedLogger } from '../logger.js';
import type { getProbesWithAdminData as serverGetProbesWithAdminData } from '../ws/server.js';
import type { Probe, ProbeLocation, Tag } from '../../probe/types.js';
import { normalizeCoordinate, normalizeFromPublicName } from '../geoip/utils.js';
import { getContinentByCountry, getIndex, getRegionByCountry } from '../location/location.js';
import { countries } from 'countries-list';
import { randomUUID } from 'crypto';

const logger = scopedLogger('adopted-probes');

export const DASH_PROBES_TABLE = 'gp_probes';
export const NOTIFICATIONS_TABLE = 'directus_notifications';
export const USERS_TABLE = 'directus_users';

type DProbe = {
	id: string;
	userId: string | null;
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
	status: string;
	isIPv4Supported: boolean;
	isIPv6Supported: boolean;
	version: string | null;
	nodeVersion: string | null;
	hardwareDevice: string | null;
	hardwareDeviceFirmware: string | null;
	country: string | null;
	city: string | null;
	state: string | null;
	latitude: number | null;
	longitude: number | null;
	asn: number | null;
	network: string | null;
	defaultPrefix: string | null;
	publicProbes: boolean;
	adoptionToken: string | null;
	customLocation: {
		country: string;
		city: string;
		latitude: number;
		longitude: number;
		state: string | null;
	} | null;
	allowedCountries: string[];
};

export type Adoption = Omit<DProbe, 'userId'> & {
	userId: string;
};

export type Row = Omit<DProbe, 'tags' | 'systemTags' | 'altIps' | 'isIPv4Supported' | 'isIPv6Supported' | 'publicProbes' | 'allowedCountries' | 'customLocation'> & {
	altIps: string;
	tags: string;
	systemTags: string;
	isIPv4Supported: number;
	isIPv6Supported: number;
	publicProbes: number;
	customLocation: string | null;
	allowedCountries: string;
};

type DProbeFieldDescription = {
	probeField: string;
	mayBeCustom: boolean;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	formatter?: (probeValue: any, probe: Probe, dProbe?: DProbe) => unknown;
};

export class AdoptedProbes {
	private dProbes: DProbe[] = [];
	private adoptions: Adoption[] = [];
	private ipToAdoption: Map<string, Adoption> = new Map();
	private uuidToAdoption: Map<string, Adoption> = new Map();
	private syncBackToDashboard = process.env['SHOULD_SYNC_ADOPTIONS'] === 'true';
	private readonly dProbeFieldToProbeField: Partial<Record<keyof DProbe, DProbeFieldDescription>> = {
		uuid: {
			probeField: 'uuid',
			mayBeCustom: false,
		},
		ip: {
			probeField: 'ipAddress',
			mayBeCustom: false,
		},
		altIps: {
			probeField: 'altIpAddresses',
			mayBeCustom: false,
		},
		status: {
			probeField: 'status',
			mayBeCustom: false,
		},
		isIPv4Supported: {
			probeField: 'isIPv4Supported',
			mayBeCustom: false,
		},
		isIPv6Supported: {
			probeField: 'isIPv6Supported',
			mayBeCustom: false,
		},
		version: {
			probeField: 'version',
			mayBeCustom: false,
		},
		nodeVersion: {
			probeField: 'nodeVersion',
			mayBeCustom: false,
		},
		hardwareDevice: {
			probeField: 'hardwareDevice',
			mayBeCustom: false,
		},
		hardwareDeviceFirmware: {
			probeField: 'hardwareDeviceFirmware',
			mayBeCustom: false,
		},
		systemTags: {
			probeField: 'tags',
			mayBeCustom: false,
			formatter: (probeTags: Tag[], _probe: Probe, dProbe?: DProbe) => [
				...(dProbe && dProbe.publicProbes && dProbe.defaultPrefix ? [ this.getGlobalUserTag(dProbe.defaultPrefix) ] : []),
				...probeTags.filter(({ type }) => type === 'system').map(({ value }) => value),
			],
		},
		asn: {
			probeField: 'location.asn',
			mayBeCustom: false,
		},
		network: {
			probeField: 'location.network',
			mayBeCustom: false,
		},
		country: {
			probeField: 'location.country',
			mayBeCustom: true,
		},
		city: {
			probeField: 'location.city',
			mayBeCustom: true,
		},
		state: {
			probeField: 'location.state',
			mayBeCustom: true,
		},
		latitude: {
			probeField: 'location.latitude',
			mayBeCustom: true,
		},
		longitude: {
			probeField: 'location.longitude',
			mayBeCustom: true,
		},
		allowedCountries: {
			probeField: 'location.allowedCountries',
			mayBeCustom: false,
		},
	};

	constructor (
		private readonly sql: Knex,
		private readonly getProbesWithAdminData: typeof serverGetProbesWithAdminData,
	) {}

	getByIp (ip: string) {
		return this.ipToAdoption.get(ip) || null;
	}

	getByUuid (uuid: string) {
		return this.uuidToAdoption.get(uuid) || null;
	}

	getUpdatedLocation (probe: Probe, adminLocation?: ProbeLocation | null): ProbeLocation | null {
		const adoption = this.getByIp(probe.ipAddress);

		if (!adoption || !adoption.customLocation || !adoption.country || !probe.location.allowedCountries.includes(adoption.country)) {
			return null;
		}

		return {
			...(adminLocation || probe.location),
			continent: getContinentByCountry(adoption.country),
			region: getRegionByCountry(adoption.country),
			country: adoption.country,
			city: adoption.city!,
			normalizedCity: normalizeFromPublicName(adoption.city!),
			state: adoption.state,
			latitude: adoption.latitude!,
			longitude: adoption.longitude!,
		};
	}

	getUpdatedTags (probe: Probe): Tag[] {
		const adoption = this.getByIp(probe.ipAddress);

		if (!adoption || (!adoption.tags.length && !adoption.publicProbes)) {
			return probe.tags;
		}

		return [
			...probe.tags,
			...(adoption.publicProbes && adoption.defaultPrefix ? [{
				type: 'system' as const,
				value: this.getGlobalUserTag(adoption.defaultPrefix),
			}] : []),
			...adoption.tags,
		];
	}

	getUpdatedProbes (probes: Probe[]) {
		return probes.map((probe) => {
			const adoption = this.getByIp(probe.ipAddress);

			if (!adoption) {
				return probe;
			}

			const newLocation = this.getUpdatedLocation(probe) || probe.location;

			const newTags = this.getUpdatedTags(probe);

			return {
				...probe,
				location: newLocation,
				tags: newTags,
				index: getIndex(newLocation, newTags),
				owner: { id: adoption.userId },
			};
		});
	}

	scheduleSync () {
		setTimeout(() => {
			this.syncDashboardData()
				.finally(() => this.scheduleSync())
				.catch(error => logger.error('Error in AdoptedProbes.syncDashboardData() (affects all probes)', error));
		}, config.get<number>('adoptedProbes.syncInterval')).unref();
	}

	async syncDashboardData () {
		await this.fetchDProbes();

		if (!this.syncBackToDashboard) {
			return;
		}

		const probes = this.getProbesWithAdminData();
		// 'probe' - usual API probe. 'dProbe' - dashboard probe data stored in sql.
		const { dProbesWithProbe, dProbesWithoutProbe, probesWithoutDProbe } = this.matchDProbesAndProbes(probes);
		const { updatedDProbes, dProbeDataUpdates } = this.generateUpdatedDProbes(dProbesWithProbe, dProbesWithoutProbe);
		const { dProbesToDelete, dProbeAltIpUpdates } = this.findDuplications(updatedDProbes);

		const dProbeUpdates = this.mergeUpdates(dProbeDataUpdates, dProbeAltIpUpdates, dProbesToDelete);

		await this.resolveIfError(this.deleteDProbes(dProbesToDelete));
		await Bluebird.map(dProbeUpdates, ({ dProbe, update }) => this.resolveIfError(this.updateDProbe(dProbe, update)), { concurrency: 8 });
		await Bluebird.map(probesWithoutDProbe, probe => this.resolveIfError(this.createDProbe(probe)), { concurrency: 8 });
	}

	private async resolveIfError (pr: Promise<void>): Promise<void> {
		return pr.catch((e) => {
			logger.error('Error while syncing individual probe data.', e);
		});
	}

	public async fetchDProbes () {
		const rows = await this.sql(DASH_PROBES_TABLE)
			.leftJoin(USERS_TABLE, `${DASH_PROBES_TABLE}.userId`, `${USERS_TABLE}.id`)
			// Fetch only adopted probes if sync back to dashboard is not required.
			.where((builder) => { !this.syncBackToDashboard && void builder.whereNotNull('userId'); })
			// First item will be preserved, so we are prioritizing adopted and online probes.
			// Sorting by id at the end so order is the same in any table state.
			.orderByRaw(`IF (${DASH_PROBES_TABLE}.userId IS NOT NULL, 1, 2), ${DASH_PROBES_TABLE}.lastSyncDate DESC, ${DASH_PROBES_TABLE}.onlineTimesToday DESC, FIELD(${DASH_PROBES_TABLE}.status, 'ready') DESC, ${DASH_PROBES_TABLE}.id DESC`)
			.select<Row[]>(`${DASH_PROBES_TABLE}.*`, `${USERS_TABLE}.default_prefix AS defaultPrefix`, `${USERS_TABLE}.public_probes as publicProbes`, `${USERS_TABLE}.adoption_token AS adoptionToken`);

		const dProbes: DProbe[] = rows.map(row => ({
			...row,
			altIps: JSON.parse(row.altIps) as string[],
			tags: (JSON.parse(row.tags) as { prefix: string; value: string; format?: string }[])
				.map(({ prefix, value, format }) => {
					if (format === 'v1') {
						return { type: 'user' as const, value: `u-${prefix}-${value}` };
					}

					return { type: 'user' as const, value: `u-${prefix}:${value}` };
				}),
			systemTags: JSON.parse(row.systemTags) as string[],
			isIPv4Supported: Boolean(row.isIPv4Supported),
			isIPv6Supported: Boolean(row.isIPv6Supported),
			latitude: row.latitude ? normalizeCoordinate(row.latitude) : row.latitude,
			longitude: row.longitude ? normalizeCoordinate(row.longitude) : row.longitude,
			publicProbes: Boolean(row.publicProbes),
			allowedCountries: JSON.parse(row.allowedCountries) as string[],
			customLocation: row.customLocation ? JSON.parse(row.customLocation) as DProbe['customLocation'] : null,
		}));

		this.dProbes = dProbes;
		this.adoptions = dProbes.filter((dProbe): dProbe is Adoption => !!dProbe.userId);

		this.ipToAdoption = new Map([
			...this.adoptions.map(adoption => [ adoption.ip, adoption ] as const),
			...this.adoptions.map(adoption => adoption.altIps.map(altIp => [ altIp, adoption ] as const)).flat(),
		]);

		this.uuidToAdoption = new Map(this.adoptions.filter(({ uuid }) => !!uuid).map(adoption => [ adoption.uuid!, adoption ]));
	}

	/**
	 * Matches probes with dProbes. Priority order:
	 * 1. Match by UUID
	 * 2. Match by IP + adopted
	 * 3. Match by alt IP + adopted
	 * 4. Match by IP
	 * 5. Match by alt IP
	 *
	 * This ensures that adopted probes take precedence over non-adopted ones when matching by IP or alt IP.
	 */
	private matchDProbesAndProbes (probes: Probe[]) {
		const uuidToProbe = new Map(probes.map(probe => [ probe.uuid, probe ]));
		const ipToProbe = new Map(probes.map(probe => [ probe.ipAddress, probe ]));
		const altIpToProbe = new Map(probes.map(probe => probe.altIpAddresses.map(altIp => [ altIp, probe ] as const)).flat());
		const dProbesWithProbe: { dProbe: DProbe; probe: Probe }[] = [];

		// Searching probe for the dProbe by: UUID.
		let dProbesWithoutProbe: DProbe[] = [];

		this.dProbes.forEach((dProbe) => {
			const probe = dProbe.uuid && uuidToProbe.get(dProbe.uuid);

			if (probe) {
				dProbesWithProbe.push({ dProbe, probe });
				uuidToProbe.delete(probe.uuid);
				ipToProbe.delete(probe.ipAddress);
				probe.altIpAddresses.forEach(altIp => altIpToProbe.delete(altIp));
			} else {
				dProbesWithoutProbe.push(dProbe);
			}
		});

		// Searching probe for the dProbe by: adopted dProbe IP -> probe IP.
		let dProbesToCheck = [ ...dProbesWithoutProbe ];
		dProbesWithoutProbe = [];

		dProbesToCheck.forEach((dProbe) => {
			const probe = ipToProbe.get(dProbe.ip);

			if (probe && dProbe.userId) {
				dProbesWithProbe.push({ dProbe, probe });
				uuidToProbe.delete(probe.uuid);
				ipToProbe.delete(probe.ipAddress);
				probe.altIpAddresses.forEach(altIp => altIpToProbe.delete(altIp));
			} else {
				dProbesWithoutProbe.push(dProbe);
			}
		});

		// Searching probe for the dProbe by: adopted dProbe IP -> probe alt IP.
		dProbesToCheck = [ ...dProbesWithoutProbe ];
		dProbesWithoutProbe = [];

		dProbesToCheck.forEach((dProbe) => {
			const probe = altIpToProbe.get(dProbe.ip);

			if (probe && dProbe.userId) {
				dProbesWithProbe.push({ dProbe, probe });
				uuidToProbe.delete(probe.uuid);
				ipToProbe.delete(probe.ipAddress);
				probe.altIpAddresses.forEach(altIp => altIpToProbe.delete(altIp));
			} else {
				dProbesWithoutProbe.push(dProbe);
			}
		});

		// Searching probe for the dProbe by: adopted dProbe alt IP -> probe IP or alt IP.
		dProbesToCheck = [ ...dProbesWithoutProbe ];
		dProbesWithoutProbe = [];

		dProbesToCheck.forEach((dProbe) => {
			for (const altIp of dProbe.altIps) {
				const probe = ipToProbe.get(altIp) || altIpToProbe.get(altIp);

				if (probe && dProbe.userId) {
					dProbesWithProbe.push({ dProbe, probe });
					uuidToProbe.delete(probe.uuid);
					ipToProbe.delete(probe.ipAddress);
					probe.altIpAddresses.forEach(altIp => altIpToProbe.delete(altIp));
					return;
				}
			}

			dProbesWithoutProbe.push(dProbe);
		});

		// Searching probe for the dProbe by: dProbe IP -> probe IP.
		dProbesToCheck = [ ...dProbesWithoutProbe ];
		dProbesWithoutProbe = [];

		dProbesToCheck.forEach((dProbe) => {
			const probe = ipToProbe.get(dProbe.ip);

			if (probe) {
				dProbesWithProbe.push({ dProbe, probe });
				uuidToProbe.delete(probe.uuid);
				ipToProbe.delete(probe.ipAddress);
				probe.altIpAddresses.forEach(altIp => altIpToProbe.delete(altIp));
			} else {
				dProbesWithoutProbe.push(dProbe);
			}
		});

		// Searching probe for the dProbe by: dProbe IP -> probe alt IP.
		dProbesToCheck = [ ...dProbesWithoutProbe ];
		dProbesWithoutProbe = [];

		dProbesToCheck.forEach((dProbe) => {
			const probe = altIpToProbe.get(dProbe.ip);

			if (probe) {
				dProbesWithProbe.push({ dProbe, probe });
				uuidToProbe.delete(probe.uuid);
				ipToProbe.delete(probe.ipAddress);
				probe.altIpAddresses.forEach(altIp => altIpToProbe.delete(altIp));
			} else {
				dProbesWithoutProbe.push(dProbe);
			}
		});

		// Searching probe for the dProbe by: dProbe alt IP -> probe IP or alt IP.
		dProbesToCheck = [ ...dProbesWithoutProbe ];
		dProbesWithoutProbe = [];

		dProbesToCheck.forEach((dProbe) => {
			for (const altIp of dProbe.altIps) {
				const probe = ipToProbe.get(altIp) || altIpToProbe.get(altIp);

				if (probe) {
					dProbesWithProbe.push({ dProbe, probe });
					uuidToProbe.delete(probe.uuid);
					ipToProbe.delete(probe.ipAddress);
					probe.altIpAddresses.forEach(altIp => altIpToProbe.delete(altIp));
					return;
				}
			}

			dProbesWithoutProbe.push(dProbe);
		});

		// Searching probe for the dProbe by: offline dProbe token+asn+city -> probe token+asn+city.
		dProbesToCheck = [ ...dProbesWithoutProbe ];
		dProbesWithoutProbe = [];
		const adoptionTokenToProbes = _.groupBy(([ ...uuidToProbe.values() ]).filter(probe => !!probe.adoptionToken), probe => `${probe.adoptionToken}-${probe.location.asn}-${probe.location.city}`);

		dProbesToCheck.forEach((dProbe) => {
			const probes = dProbe.adoptionToken && dProbe.status === 'offline' && adoptionTokenToProbes[`${dProbe.adoptionToken}-${dProbe.asn}-${dProbe.city}`];
			const probe = probes && probes.length > 0 && probes.shift();

			if (probe) {
				dProbesWithProbe.push({ dProbe, probe });
				uuidToProbe.delete(probe.uuid);
				ipToProbe.delete(probe.ipAddress);
				probe.altIpAddresses.forEach(altIp => altIpToProbe.delete(altIp));
			} else {
				dProbesWithoutProbe.push(dProbe);
			}
		});

		const probesWithoutDProbe = [ ...uuidToProbe.values() ];
		return { dProbesWithProbe, dProbesWithoutProbe, probesWithoutDProbe };
	}

	private generateUpdatedDProbes (dProbesWithProbe: { dProbe: DProbe; probe: Probe }[], dProbesWithoutProbe: DProbe[]) {
		const dProbeDataUpdates: { dProbe: DProbe; update: Partial<DProbe> }[] = [];
		const updatedDProbes: DProbe[] = [];

		dProbesWithProbe.forEach(({ dProbe, probe }) => {
			const updateObject: Record<string, unknown> = {};

			Object.entries(this.dProbeFieldToProbeField).forEach(([ dProbeField, { probeField, mayBeCustom, formatter }]) => {
				const dProbeValue = _.get(dProbe, dProbeField) as unknown;
				let probeValue = _.get(probe, probeField) as unknown;

				if (formatter) {
					probeValue = formatter(probeValue, probe, dProbe);
				}

				let targetValue = probeValue;

				if (mayBeCustom && dProbe.customLocation && probe.location.allowedCountries.includes(dProbe.customLocation.country)) {
					const customValue = _.get(dProbe.customLocation, dProbeField) as unknown;
					targetValue = customValue;
				}

				if (!_.isEqual(dProbeValue, targetValue)) {
					updateObject[dProbeField] = targetValue;
				}
			});

			if (!this.isToday(dProbe.lastSyncDate)) {
				updateObject['lastSyncDate'] = new Date();
			}

			if (!_.isEmpty(updateObject)) {
				dProbeDataUpdates.push({ dProbe, update: updateObject });
			}

			updatedDProbes.push({ ...dProbe, ...updateObject });
		});

		dProbesWithoutProbe.forEach((dProbe) => {
			const updateObject = {
				...(dProbe.status !== 'offline' && { status: 'offline' }),
			};

			if (!_.isEmpty(updateObject)) {
				dProbeDataUpdates.push({ dProbe, update: updateObject });
			}

			updatedDProbes.push({ ...dProbe, ...updateObject });
		});

		return { dProbeDataUpdates, updatedDProbes };
	}

	private findDuplications (updatedDProbes: DProbe[]) {
		const dProbesToDelete: DProbe[] = [];
		const dProbeAltIpUpdates: { dProbe: DProbe; update: { altIps: string[] } }[] = [];
		const uniqIps = new Map<string, DProbe>();

		updatedDProbes.forEach((dProbe) => {
			const existingDProbe = uniqIps.get(dProbe.ip);

			if (
				existingDProbe
				&& existingDProbe.country === dProbe.country
				&& (existingDProbe.userId === dProbe.userId || dProbe.userId === null)
			) {
				logger.warn(`Duplication found by IP ${dProbe.ip}`, {
					stay: _.pick(existingDProbe, [ 'id', 'uuid', 'ip', 'altIps' ]),
					delete: _.pick(dProbe, [ 'id', 'uuid', 'ip', 'altIps' ]),
				});

				dProbesToDelete.push(dProbe);
				return;
			} else if (existingDProbe) {
				logger.error(`Unremovable duplication found by IP ${dProbe.ip}`, {
					stay: _.pick(existingDProbe, [ 'id', 'uuid', 'ip', 'altIps' ]),
					duplicate: _.pick(dProbe, [ 'id', 'uuid', 'ip', 'altIps' ]),
				});
			}

			const duplicatedAltIps: string[] = [];
			const newAltIps: string[] = [];

			for (const altIp of dProbe.altIps) {
				if (uniqIps.has(altIp)) {
					duplicatedAltIps.push(altIp);
				} else {
					newAltIps.push(altIp);
				}
			}

			if (duplicatedAltIps.length) {
				dProbeAltIpUpdates.push({ dProbe, update: { altIps: newAltIps } });
			}

			uniqIps.set(dProbe.ip, dProbe);
			newAltIps.forEach(altIp => uniqIps.set(altIp, dProbe));
		});

		return { dProbesToDelete, dProbeAltIpUpdates };
	}

	private mergeUpdates (
		dProbeDataUpdates: { dProbe: DProbe; update: Partial<DProbe> }[],
		dProbeAltIpUpdates: { dProbe: DProbe; update: { altIps: string[] } }[],
		dProbesToDelete: DProbe[],
	): { dProbe: DProbe; update: Partial<DProbe> }[] {
		const altIpUpdatesById = new Map(dProbeAltIpUpdates.map(altIpUpdate => [ altIpUpdate.dProbe.id, altIpUpdate ]));

		const dProbeUpdates = dProbeDataUpdates.map((dProbeDataUpdate) => {
			const { dProbe, update } = dProbeDataUpdate;
			const altIpUpdate = altIpUpdatesById.get(dProbe.id);

			if (altIpUpdate) {
				altIpUpdatesById.delete(dProbe.id);
				return { dProbe, update: { ...update, ...altIpUpdate.update } };
			}

			return dProbeDataUpdate;
		});

		// Some of the altIpUpdatesById are merged with dProbeUpdates, others are included here.
		const allUpdates = [ ...dProbeUpdates, ...altIpUpdatesById.values() ];

		// Removing updates of probes that will be deleted.
		const deleteIds = dProbesToDelete.map(({ id }) => id);
		const filteredUpdates = allUpdates.filter(({ dProbe }) => !deleteIds.includes(dProbe.id));
		return filteredUpdates;
	}

	private async updateDProbe (dProbe: DProbe, update: Partial<DProbe>) {
		const formattedUpdate = Object.fromEntries(Object.entries(update).map(([ key, value ]) => [
			key, (_.isObject(value) && !_.isDate(value)) ? JSON.stringify(value) : value,
		]));

		await this.sql(DASH_PROBES_TABLE).where({ id: dProbe.id }).update(formattedUpdate);

		// If there is a custom city in a country that is no longer in the allowedCountries list, send notification to user.
		if (update.country && dProbe.userId) {
			const adoption = dProbe as Adoption;

			if (dProbe.customLocation && dProbe.country === dProbe.customLocation.country) {
				await this.sendNotificationCityNotApplied(adoption, update.country);
			} else if (dProbe.customLocation && update.country === dProbe.customLocation.country) {
				await this.sendNotificationCityAppliedAgain(adoption, update.country);
			}
		}
	}

	private async deleteDProbes (dProbesToDelete: DProbe[]) {
		if (dProbesToDelete.length) {
			logger.warn('Deleting ids:', dProbesToDelete.map(({ id }) => id));
			await this.sql(DASH_PROBES_TABLE).whereIn('id', dProbesToDelete.map(({ id }) => id)).delete();
		}
	}

	private async createDProbe (probe: Probe) {
		const dProbe: Record<string, unknown> = {
			id: randomUUID(),
			date_created: new Date(),
			lastSyncDate: new Date(),
		};

		Object.entries(this.dProbeFieldToProbeField).forEach(([ dProbeField, { probeField, formatter }]) => {
			let probeValue = _.get(probe, probeField) as unknown;

			if (formatter) {
				probeValue = formatter(probeValue, probe);
			}

			if (_.isObject(probeValue) && !_.isDate(probeValue)) {
				probeValue = JSON.stringify(probeValue);
			}

			dProbe[dProbeField] = probeValue;
		});

		await this.sql(DASH_PROBES_TABLE).insert(dProbe);
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
			`Globalping detected that your ${adoption.name ? `probe [**${adoption.name}**](/probes/${adoption.id}) with IP address **${adoption.ip}**` : `[probe with IP address **${adoption.ip}**](/probes/${adoption.id})`} has changed its location from ${oldCountry} to ${newCountry}. The custom city value "${adoption.customLocation!.city}" is not applied anymore.\n\nIf this change is not right, please follow the steps in [this issue](https://github.com/jsdelivr/globalping/issues/660).`,
		);
	}

	private async sendNotificationCityAppliedAgain (adoption: Adoption, probeCountry: string) {
		const newCountry = countries[probeCountry as keyof typeof countries]?.name || probeCountry;
		const oldCountry = countries[adoption.country as keyof typeof countries]?.name || adoption.country;

		return this.sendNotification(
			adoption.userId,
			`Your probe's location has changed back`,
			`Globalping detected that your ${adoption.name ? `probe [**${adoption.name}**](/probes/${adoption.id}) with IP address **${adoption.ip}**` : `[probe with IP address **${adoption.ip}**](/probes/${adoption.id})`} has changed its location back from ${oldCountry} to ${newCountry}. The custom city value "${adoption.customLocation!.city}" is now applied again.`,
		);
	}

	private isToday (date: Date) {
		const currentDate = new Date();
		return date.toDateString() === currentDate.toDateString();
	}

	private getGlobalUserTag (defaultPrefix: string) {
		return `u-${defaultPrefix}`;
	}

	static formatProbeAsDProbe (probe: Probe): Omit<DProbe, 'id' | 'lastSyncDate' | 'defaultPrefix' | 'publicProbes'> {
		return {
			userId: null,
			ip: probe.ipAddress,
			name: null,
			altIps: probe.altIpAddresses,
			uuid: probe.uuid,
			tags: [],
			systemTags: probe.tags.filter(({ type }) => type === 'system').map(({ value }) => value),
			status: probe.status,
			isIPv4Supported: probe.isIPv4Supported,
			isIPv6Supported: probe.isIPv6Supported,
			version: probe.version,
			nodeVersion: probe.nodeVersion,
			hardwareDevice: probe.hardwareDevice,
			hardwareDeviceFirmware: probe.hardwareDeviceFirmware,
			city: probe.location.city,
			state: probe.location.state,
			country: probe.location.country,
			latitude: probe.location.latitude,
			longitude: probe.location.longitude,
			asn: probe.location.asn,
			network: probe.location.network,
			adoptionToken: probe.adoptionToken,
			allowedCountries: probe.location.allowedCountries,
			customLocation: null,
		};
	}
}
