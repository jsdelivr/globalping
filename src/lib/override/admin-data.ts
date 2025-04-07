/* eslint-disable camelcase */
import ipaddr from 'ipaddr.js';
import type { Knex } from 'knex';
import config from 'config';
import type { Probe, ProbeLocation } from '../../probe/types.js';
import { normalizeFromPublicName } from '../geoip/utils.js';
import { getContinentByCountry, getRegionByCountry } from '../location/location.js';
import { scopedLogger } from '../logger.js';
import _ from 'lodash';

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
	allowedCountries: string[];
}

export class AdminData {
	private rangesToUpdatedFields: Map<ParsedIpRange, UpdatedFields> = new Map();

	private ipsToUpdatedFieldsCache: Map<string, UpdatedFields | null> = new Map();

	private lastUpdate: Date = new Date('01-01-1970');

	private lastOverridesLength: number = 0;

	private parseIp = _.memoize(ipaddr.parse);

	private parseCidr = _.memoize(ipaddr.parseCIDR);

	constructor (private readonly sql: Knex) {}

	scheduleSync () {
		setTimeout(() => {
			this.syncDashboardData()
				.finally(() => this.scheduleSync())
				.catch(error => logger.error('Error in AdminData.syncDashboardData()', error));
		}, config.get<number>('adminData.syncInterval')).unref();
	}

	async syncDashboardData () {
		const overrides = await this.sql(LOCATION_OVERRIDES_TABLE).select<LocationOverride[]>();

		this.rangesToUpdatedFields = new Map(overrides.map(override => [ this.parseCidr(override.ip_range), {
			continent: getContinentByCountry(override.country),
			region: getRegionByCountry(override.country),
			city: override.city,
			normalizedCity: normalizeFromPublicName(override.city),
			country: override.country,
			state: override.state,
			latitude: override.latitude,
			longitude: override.longitude,
			allowedCountries: [ override.country ],
		}]));

		const newLastUpdate = overrides.reduce((lastUpdate, { date_created, date_updated }) => {
			lastUpdate = date_created > lastUpdate ? date_created : lastUpdate;
			lastUpdate = (date_updated && date_updated > lastUpdate) ? date_updated : lastUpdate;
			return lastUpdate;
		}, new Date('01-01-1970'));

		if (newLastUpdate > this.lastUpdate || overrides.length !== this.lastOverridesLength) {
			this.ipsToUpdatedFieldsCache.clear();
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
		const ips = [ probe.ipAddress, ...probe.altIpAddresses ];

		if (ips.some(ip => this.ipsToUpdatedFieldsCache.get(ip) === undefined)) {
			const newUpdatedFields = this.findUpdatedFields(probe);
			this.ipsToUpdatedFieldsCache.set(probe.ipAddress, newUpdatedFields);
			probe.altIpAddresses.forEach(altIp => this.ipsToUpdatedFieldsCache.set(altIp, newUpdatedFields));
		}

		return this.ipsToUpdatedFieldsCache.get(probe.ipAddress)!;
	}

	findUpdatedFields (probe: Probe): UpdatedFields | null {
		const parsedIps = [ probe.ipAddress, ...probe.altIpAddresses ].map(this.parseIp);

		for (const [ range, updatedFields ] of this.rangesToUpdatedFields) {
			for (const ip of parsedIps) {
				if (ip.kind() === range[0].kind() && ip.match(range)) {
					return updatedFields;
				}
			}
		}

		return null;
	}
}
