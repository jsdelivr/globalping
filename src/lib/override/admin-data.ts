/* eslint-disable camelcase */
import ipaddr from 'ipaddr.js';
import type { Knex } from 'knex';
import type { Probe, ProbeLocation } from '../../probe/types.js';
import { normalizeFromPublicName } from '../geoip/utils.js';
import { getContinentByCountry, getRegionByCountry } from '../location/location.js';
import { scopedLogger } from '../logger.js';

const logger = scopedLogger('admin-data');

const LOCATION_OVERRIDES_TABLE = 'gp_location_overrides';

type ParsedIpRange = [ipaddr.IPv4 | ipaddr.IPv6, number];

type LocationOverride = {
	date_created: Date;
	date_updated: Date | null;
	ip_range: string;
	city: string;
	country: string;
	state: string | null;
	latitude: number;
	longitude: number;
}

type UpdatedFields = {
	continent: string;
	region: string;
	city: string;
	normalizedCity: string;
	country: string;
	state: string | null;
	latitude: number;
	longitude: number;
}

export class AdminData {
	private rangesToUpdatedFields: Map<ParsedIpRange, UpdatedFields> = new Map();

	private ipsToUpdatedFields: Map<string, UpdatedFields | null> = new Map();

	private lastUpdate: Date = new Date('01-01-1970');

	private lastOverridesLength: number = 0;

	constructor (private readonly sql: Knex) {}

	scheduleSync () {
		setTimeout(() => {
			this.syncDashboardData()
				.finally(() => this.scheduleSync())
				.catch(error => logger.error(error));
		}, 60_000).unref();
	}

	async syncDashboardData () {
		const overrides = await this.sql(LOCATION_OVERRIDES_TABLE).select<LocationOverride[]>();

		this.rangesToUpdatedFields = new Map(overrides.map(override => [ ipaddr.parseCIDR(override.ip_range), {
			continent: getContinentByCountry(override.country),
			region: getRegionByCountry(override.country),
			city: override.city,
			normalizedCity: normalizeFromPublicName(override.city),
			country: override.country,
			state: override.state,
			latitude: override.latitude,
			longitude: override.longitude,
		}]));

		const newLastUpdate = overrides.reduce((lastUpdate, { date_created, date_updated }) => {
			lastUpdate = date_created > lastUpdate ? date_created : lastUpdate;
			lastUpdate = (date_updated && date_updated > lastUpdate) ? date_updated : lastUpdate;
			return lastUpdate;
		}, new Date('01-01-1970'));

		if (newLastUpdate > this.lastUpdate || overrides.length !== this.lastOverridesLength) {
			this.ipsToUpdatedFields.clear();
			this.lastUpdate = newLastUpdate;
			this.lastOverridesLength = overrides.length;
		}
	}

	getUpdatedProbes (probes: Probe[]) {
		return probes.map((probe) => {
			const updatedFields = this.getUpdatedFields(probe);

			if (!updatedFields) {
				return probe;
			}

			return {
				...probe,
				location: {
					...probe.location,
					...updatedFields,
				},
			};
		});
	}

	getUpdatedLocation (probe: Probe): ProbeLocation | null {
		const updatedFields = this.getUpdatedFields(probe);

		if (!updatedFields) {
			return null;
		}

		return {
			...probe.location,
			...updatedFields,
		};
	}

	private getUpdatedFields (probe: Probe): UpdatedFields | null {
		const updatedFields = this.ipsToUpdatedFields.get(probe.ipAddress);

		if (updatedFields !== undefined) {
			return updatedFields;
		}

		const newUpdatedFields = this.findUpdatedFields(probe);
		this.ipsToUpdatedFields.set(probe.ipAddress, newUpdatedFields);
		return newUpdatedFields;
	}

	findUpdatedFields (probe: Probe): UpdatedFields | null {
		for (const [ range, updatedFields ] of this.rangesToUpdatedFields) {
			const ip = ipaddr.parse(probe.ipAddress);

			if (ip.kind() === range[0].kind() && ip.match(range)) {
				return updatedFields;
			}
		}

		return null;
	}
}
