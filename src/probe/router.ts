import _ from 'lodash';
import type { LocationWithLimit, MeasurementRequest, MeasurementResult, UserRequest } from '../measurement/types.js';
import type { Location } from '../lib/location/types.js';
import type { OfflineProbe, Probe } from './types.js';
import { ProbesLocationFilter } from './probes-location-filter.js';
import { getMeasurementStore, MeasurementStore } from '../measurement/store.js';
import { getGroupingKey, normalizeFromPublicName, normalizeNetworkName } from '../lib/geoip/utils.js';
import { onProbesUpdate as onServerProbesUpdate } from '../lib/ws/server.js';
import { captureSpan } from '../lib/metrics.js';

export class ProbeRouter {
	private readonly probesFilter = new ProbesLocationFilter();
	private readyProbes: Probe[] = [];

	constructor (
		private readonly onProbesUpdate: typeof onServerProbesUpdate,
		private readonly store: MeasurementStore,
	) {
		this.onProbesUpdate((probes) => {
			this.readyProbes = probes.filter(probe => probe.status === 'ready');
			this.probesFilter.updateGlobalIndex(probes);
		});
	}

	public async findMatchingProbes (userRequest: UserRequest): Promise<{
		onlineProbesMap: Map<number, Probe>;
		allProbes: (Probe | OfflineProbe)[];
		request: MeasurementRequest;
	}> {
		const locations = userRequest.locations ?? [];
		const globalLimit = userRequest.limit ?? 1;

		if (typeof locations === 'string') { // the measurement id of existing measurement was provided by the user, the same probes are to be used
			return this.findWithMeasurementId(this.readyProbes, locations, userRequest);
		}

		const preferredIpVersion = userRequest.measurementOptions?.ipVersion ?? 4;
		const connectedProbesFilteredByIpVersion = this.probesFilter.filterByIpVersion(this.readyProbes, preferredIpVersion);

		let filtered: Probe[] = [];

		if (locations.some(l => l.limit)) {
			filtered = captureSpan('findWithLocationLimit', () => this.findWithLocationLimit(connectedProbesFilteredByIpVersion, locations));
		} else if (locations.length > 0) {
			filtered = captureSpan('findWithGlobalLimit', () => this.findWithGlobalLimit(connectedProbesFilteredByIpVersion, locations, globalLimit));
		} else {
			filtered = captureSpan('findGloballyDistributed', () => this.findGloballyDistributed(connectedProbesFilteredByIpVersion, globalLimit));
		}

		if (filtered.length === 0 && locations.length === 1 && locations[0]?.magic) {
			return this.findWithMeasurementId(this.readyProbes, locations[0].magic, userRequest);
		}

		return {
			allProbes: filtered,
			onlineProbesMap: new Map(filtered.entries()),
			request: userRequest as MeasurementRequest,
		};
	}

	private findGloballyDistributed (probes: Probe[], limit: number): Probe[] {
		return this.probesFilter.filterGloballyDistributed(probes, limit);
	}

	private findWithGlobalLimit (probes: Probe[], locations: Location[], limit: number): Probe[] {
		const weight = 100 / locations.length;
		const distribution = new Map(locations.map(l => [ l, weight ]));

		return this.probesFilter.filterByLocationAndWeight(probes, distribution, limit);
	}

	private findWithLocationLimit (probes: Probe[], locations: LocationWithLimit[]): Probe[] {
		const grouped = new Map<LocationWithLimit, Probe[]>();

		for (const location of locations) {
			const { limit, ...l } = location;
			const found = captureSpan('filterByLocation', () => this.probesFilter.filterByLocation(probes, l));

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
		const ipToConnectedProbe = new Map(connectedProbes.map(probe => [
			[ probe.ipAddress, probe ] as const,
			...probe.altIpAddresses.map(altIp => [ altIp, probe ] as const),
		]).flat());
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
		isIPv4Supported: false,
		isIPv6Supported: false,
		client: null,
		version: null,
		nodeVersion: null,
		uuid: null,
		isHardware: false,
		hardwareDevice: null,
		hardwareDeviceFirmware: null,
		ipAddress: ip,
		altIpAddresses: [],
		host: null,
		hostInfo: {
			totalMemory: null,
			totalDiskSize: null,
			availableDiskSpace: null,
		},
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
			allowedCountries: [ test.probe.country ],
			groupingKey: getGroupingKey(test.probe.country, test.probe.state, normalizeFromPublicName(test.probe.city), test.probe.asn),
		},
		index: [],
		resolvers: test.probe.resolvers,
		tags: test.probe.tags.map(tag => ({ value: tag, type: 'offline' })),
		normalizedTags: test.probe.tags.map(tag => ({ value: tag.toLowerCase(), type: 'offline' })),
		stats: {
			cpu: {
				load: [],
			},
			jobs: { count: null },
		},
		adoptionToken: null,
	});
}

// Factory

let router: ProbeRouter;

export const getProbeRouter = () => {
	if (!router) {
		router = new ProbeRouter(onServerProbesUpdate, getMeasurementStore());
	}

	return router;
};
