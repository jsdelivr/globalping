import _ from 'lodash';
import { fetchSockets } from '../lib/ws/fetch-sockets.js';
import type { LocationWithLimit, MeasurementRecord } from '../measurement/types.js';
import type { Location } from '../lib/location/types.js';
import type { Probe } from './types.js';
import { ProbesLocationFilter } from './probes-location-filter.js';
import { getMeasurementStore } from '../measurement/store.js';

export class ProbeRouter {
	private readonly probesFilter = new ProbesLocationFilter();

	private readonly store = getMeasurementStore();

	constructor (private readonly fetchWsSockets: typeof fetchSockets) {}

	public async findMatchingProbes (
		locations: LocationWithLimit[] | string = [],
		globalLimit = 1,
	): Promise<Probe[]> {
		const probes = await this.fetchProbes();
		let filtered: Probe[] = [];

		if (typeof locations === 'string') {
			filtered = await this.findWithMeasurementId(probes, locations);
		} else if (locations.some(l => l.limit)) {
			filtered = this.findWithLocationLimit(probes, locations);
		} else if (locations.length > 0) {
			filtered = this.findWithGlobalLimit(probes, locations, globalLimit);
		} else {
			filtered = this.findGloballyDistributed(probes, globalLimit);
		}

		return filtered;
	}

	private async fetchProbes (): Promise<Probe[]> {
		const sockets = await this.fetchWsSockets();
		return sockets.filter(s => s.data.probe.status === 'ready').map(s => s.data.probe);
	}

	private findGloballyDistributed (probes: Probe[], limit: number): Probe[] {
		return this.probesFilter.filterGloballyDistibuted(probes, limit);
	}

	private findWithGlobalLimit (probes: Probe[], locations: Location[], limit: number): Probe[] {
		const weight = Math.floor(100 / locations.length);
		const distribution = new Map(locations.map(l => [ l, weight ]));

		return this.probesFilter.filterByLocationAndWeight(probes, distribution, limit);
	}

	private findWithLocationLimit (probes: Probe[], locations: LocationWithLimit[]): Probe[] {
		const grouped = new Map<LocationWithLimit, Probe[]>();

		for (const location of locations) {
			const { limit, ...l } = location;
			const found = this.probesFilter.filterByLocation(probes, l);

			if (found.length > 0) {
				grouped.set(location, found);
			}
		}

		const picked = new Set<Probe>();

		for (const [ loc, soc ] of grouped) {
			for (const s of _.take(soc, loc.limit)) {
				picked.add(s);
			}
		}

		return [ ...picked ];
	}

	private async findWithMeasurementId (probes: Probe[], measurementId: string): Promise<Probe[]> {
		let prevMeasurement: MeasurementRecord | undefined;
		const prevIps = await this.store.getIpsByMeasurementId(measurementId);
		const ipToProbe = new Map(probes.map(probe => [ probe.ipAddress, probe ]));
		const result: Probe[] = [];

		for (let i = 0; i < prevIps.length; i++) {
			const ip = prevIps[i]!;
			const probe = ipToProbe.get(ip);

			if (probe) {
				result.push(probe);
			} else {
				if (!prevMeasurement) {
					prevMeasurement = await this.store.getMeasurementJson(measurementId);

					if (!prevMeasurement) { return []; }
				}

				const prevTest = prevMeasurement.results[i];

				if (!prevTest) { return []; }

				const offlineProbe: Probe = {
					status: 'offline',
					client: '',
					version: '',
					nodeVersion: '',
					uuid: '',
					isHardware: false,
					hardwareDevice: null,
					ipAddress: ip,
					host: '',
					location: {
						continent: prevTest.probe.continent,
						region: prevTest.probe.region,
						country: prevTest.probe.country,
						city: prevTest.probe.city,
						normalizedCity: prevTest.probe.city.toLowerCase(),
						asn: prevTest.probe.asn,
						latitude: prevTest.probe.latitude,
						longitude: prevTest.probe.longitude,
						state: prevTest.probe.state ?? undefined,
						network: prevTest.probe.network,
						normalizedNetwork: prevTest.probe.network.toLowerCase(),
					},
					index: [],
					resolvers: prevTest.probe.resolvers,
					tags: prevTest.probe.tags.map(tag => ({ value: tag, type: 'system' })),
					stats: {
						cpu: {
							count: 0,
							load: [],
						},
						jobs: { count: 0 },
					},
				};
				result.push(offlineProbe);
			}
		}

		return result;
	}
}

// Factory

let router: ProbeRouter;

export const getProbeRouter = () => {
	if (!router) {
		router = new ProbeRouter(fetchSockets);
	}

	return router;
};
