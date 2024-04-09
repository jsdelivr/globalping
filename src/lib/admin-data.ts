import ipaddr from 'ipaddr.js';
import type { Knex } from 'knex';
import type { Probe } from '../probe/types.js';
import { normalizeFromPublicName } from './geoip/utils.js';
import { scopedLogger } from './logger.js';

const logger = scopedLogger('admin-data');

const LOCATION_OVERRIDES_TABLE = 'gp_location_overrides';

type ParsedIpRange = [ipaddr.IPv4 | ipaddr.IPv6, number];

type LocationOverride = {
	ip_range: string;
	city: string;
	country: string;
	state: string | null;
	latitude: number;
	longitude: number;
}

export class AdminData {
	private locationOverrides: Map<ParsedIpRange, LocationOverride> = new Map();

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

		this.locationOverrides = new Map(overrides.map(override => [ ipaddr.parseCIDR(override.ip_range), override ]));
	}

	getUpdatedProbes (probes: Probe[]) {
		return probes.map(probe => ({
			...probe,
			location: this.getUpdatedLocation(probe),
		}));
	}

	getUpdatedLocation (probe: Probe) {
		for (const [ range, adminData ] of this.locationOverrides) {
			const ip = ipaddr.parse(probe.ipAddress);

			if (ip.kind() === range[0].kind() && ip.match(range)) {
				return {
					...probe.location,
					city: adminData.city,
					normalizedCity: normalizeFromPublicName(adminData.city),
					country: adminData.country,
					...(adminData.state && { state: adminData.state }),
					latitude: adminData.latitude,
					longitude: adminData.longitude,
				};
			}
		}

		return probe.location;
	}
}
