import _ from 'lodash';
import type { LocationWithLimit, MeasurementRequest, MeasurementResult, UserRequest } from '../measurement/types.js';
import type { Location } from '../lib/location/types.js';
import type { OfflineProbe, Probe } from './types.js';
import { ProbesLocationFilter } from './probes-location-filter.js';
import { getMeasurementStore, MeasurementStore } from '../measurement/store.js';
import { normalizeFromPublicName, normalizeNetworkName } from '../lib/geoip/utils.js';
import { fetchProbes as serverFetchProbes } from '../lib/ws/server.js';

export class ProbeRouter {
	private readonly probesFilter = new ProbesLocationFilter();

	constructor (
		private readonly fetchProbes: typeof serverFetchProbes,
		private readonly store: MeasurementStore,
	) {}

	public async findMatchingProbes (userRequest: UserRequest): Promise<{
		onlineProbesMap: Map<number, Probe>;
		allProbes: (Probe | OfflineProbe)[];
		request: MeasurementRequest;
	}> {
		const locations = userRequest.locations ?? [];
		const globalLimit = userRequest.limit ?? 1;

		const preferredIpVersion = userRequest.measurementOptions?.ipVersion ?? 4;
		const connectedProbes = (await this.fetchProbes()).filter(probe => probe.status === 'ready');


		if (typeof locations === 'string') { // the measurement id of existing measurement was provided by the user, the same probes are to be used
			return this.findWithMeasurementId(connectedProbes, locations, userRequest);
		}

		const connectedProbesFilteredByIpVersion = this.probesFilter.filterByIpVersion(connectedProbes, preferredIpVersion);

		if (locations.some(l => l.limit)) {
			const filtered = this.findWithLocationLimit(connectedProbesFilteredByIpVersion, locations);
			return this.processFiltered(filtered, connectedProbesFilteredByIpVersion, locations, userRequest);
		}

		if (locations.length > 0) {
			const filtered = this.findWithGlobalLimit(connectedProbesFilteredByIpVersion, locations, globalLimit);
			return this.processFiltered(filtered, connectedProbesFilteredByIpVersion, locations, userRequest);
		}

		const filtered = this.findGloballyDistributed(connectedProbesFilteredByIpVersion, globalLimit);
		return this.processFiltered(filtered, connectedProbesFilteredByIpVersion, locations, userRequest);
	}

	private async processFiltered (filtered: Probe[], connectedProbes: Probe[], locations: LocationWithLimit[], request: UserRequest) {
		if (filtered.length === 0 && locations.length === 1 && locations[0]?.magic) {
			return this.findWithMeasurementId(connectedProbes, locations[0].magic, request);
		}

		return {
			allProbes: filtered,
			onlineProbesMap: new Map(filtered.entries()),
			request: request as MeasurementRequest,
		};
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

	private async findWithMeasurementId (connectedProbes: Probe[], measurementId: string, userRequest: UserRequest): Promise<{
		onlineProbesMap: Map<number, Probe>;
		allProbes: (Probe | OfflineProbe)[];
		request: MeasurementRequest;
	}> {
		const ipToConnectedProbe = new Map(connectedProbes.map(probe => [ probe.ipAddress, probe ]));
		const prevIps = await this.store.getMeasurementIps(measurementId);
		const prevMeasurement = await this.store.getMeasurement(measurementId);

		const emptyResult = { onlineProbesMap: new Map(), allProbes: [], request: userRequest } as {
			onlineProbesMap: Map<number, Probe>;
			allProbes: (Probe | OfflineProbe)[];
			request: MeasurementRequest;
		};

		if (!prevMeasurement || prevIps.length === 0) {
			return emptyResult;
		}

		const request: MeasurementRequest = { ...userRequest, limit: prevMeasurement.limit, locations: prevMeasurement.locations };
		const onlineProbesMap: Map<number, Probe> = new Map();
		const allProbes: (Probe | OfflineProbe)[] = [];

		for (let i = 0; i < prevIps.length; i++) {
			const ip = prevIps[i]!;
			const connectedProbe = ipToConnectedProbe.get(ip);

			if (connectedProbe) {
				onlineProbesMap.set(i, connectedProbe);
				allProbes.push(connectedProbe);
			} else {
				const prevTest = prevMeasurement.results[i];

				if (!prevTest) {
					return emptyResult;
				}

				const offlineProbe = this.testToOfflineProbe(prevTest, ip);
				allProbes.push(offlineProbe);
			}
		}

		return { onlineProbesMap, allProbes, request };
	}

	private testToOfflineProbe = (test: MeasurementResult, ip: string): OfflineProbe => ({
		status: 'offline',
		client: null,
		version: null,
		nodeVersion: null,
		uuid: null,
		isHardware: false,
		hardwareDevice: null,
		ipAddress: ip,
		host: null,
		location: {
			continent: test.probe.continent,
			region: test.probe.region,
			country: test.probe.country,
			city: test.probe.city,
			normalizedCity: normalizeFromPublicName(test.probe.city),
			asn: test.probe.asn,
			latitude: test.probe.latitude,
			longitude: test.probe.longitude,
			state: test.probe.state,
			network: test.probe.network,
			normalizedNetwork: normalizeNetworkName(test.probe.network),
		},
		index: [],
		resolvers: test.probe.resolvers,
		tags: test.probe.tags.map(tag => ({ value: tag, type: 'offline' })),
		stats: {
			cpu: {
				count: 0,
				load: [],
			},
			jobs: { count: 0 },
		},
	} as OfflineProbe);
}

// Factory

let router: ProbeRouter;

export const getProbeRouter = () => {
	if (!router) {
		router = new ProbeRouter(serverFetchProbes, getMeasurementStore());
	}

	return router;
};
