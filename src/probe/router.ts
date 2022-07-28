import _ from 'lodash';
import config from 'config';
import type {RemoteSocket} from 'socket.io';
import type {DefaultEventsMap} from 'socket.io/dist/typed-events';
import type {SocketData, WsServer} from '../lib/ws/server.js';
import {getWsServer, PROBES_NAMESPACE} from '../lib/ws/server.js';
import type {LocationWithLimit} from '../measurement/types.js';
import type {Location} from '../lib/location/types.js';
import type {Probe, ProbeLocation} from './types.js';

type Socket = RemoteSocket<DefaultEventsMap, SocketData>;

/*
 * [
 *    [ public key, internal key]
 * ]
 *
 * */
const locationKeyMap = [
	['region', 'normalizedRegion'],
	['network', 'normalizedNetwork'],
	['city', 'normalizedCity'],
];

export class ProbeRouter {
	constructor(
		private readonly io: WsServer,
	) {}

	async findMatchingProbes(
		locations: LocationWithLimit[] = [],
		globalLimit = 1,
	): Promise<Probe[]> {
		const sockets = await this.fetchSockets();
		let filtered: Socket[] = [];

		if (locations.some(l => l.limit)) {
			filtered = this.filterWithLocationLimit(sockets, locations);
		} else {
			filtered = locations.length > 0 ? this.filterWithGlobalLimit(sockets, locations, globalLimit) : this.filterGloballyDistributed(sockets, globalLimit);
		}

		return filtered.map(s => s.data.probe);
	}

	private async fetchSockets(): Promise<Socket[]> {
		const sockets = await this.io.of(PROBES_NAMESPACE).fetchSockets();
		return sockets.filter(s => s.data.probe.ready);
	}

	private findByLocation(sockets: Socket[], location: Location): Socket[] {
		if (location.magic === 'world') {
			return this.filterGloballyDistributed(sockets, sockets.length);
		}

		return sockets.filter(s => Object.keys(location).every(k => {
			if (k === 'magic') {
				const {index} = s.data.probe;
				const locationList = String(location[k]).split('+').map(l => l.replace('-', ' ').trim().toLowerCase());
				return locationList.every(l => index.find(v => v.includes(l)));
			}

			const key = locationKeyMap.find(m => m.includes(k))?.[1] ?? k;

			return location[k as keyof Location] === s.data.probe.location[key as keyof ProbeLocation];
		}));
	}

	private findByLocationAndWeight(sockets: Socket[], distribution: Map<Location, number>, limit: number): Socket[] {
		const grouped: Map<Location, Socket[]> = new Map();

		for (const [location] of distribution) {
			const found = _.shuffle(this.findByLocation(sockets, location));
			if (found.length > 0) {
				grouped.set(location, found);
			}
		}

		const picked: Set<Socket> = new Set();

		while (grouped.size > 0 && picked.size < limit) {
			const selectedCount = picked.size;

			for (const [k, v] of grouped) {
				// Circuit-breaker - we don't want to get more probes than was requested
				if (picked.size === limit) {
					break;
				}

				const weight = distribution.get(k);

				if (!weight) {
					continue;
				}

				const count = Math.ceil((limit - selectedCount) * weight / 100);

				for (const s of v.splice(0, count)) {
					picked.add(s);
				}

				if (v.length === 0) {
					grouped.delete(k);
				}
			}
		}

		return [...picked];
	}

	private filterGloballyDistributed(sockets: Socket[], limit: number): Socket[] {
		const distribution = new Map<Location, number>(
			_.shuffle(Object.entries(config.get<Record<string, number>>('measurement.globalDistribution')))
				.map(([value, weight]) => ([{continent: value}, weight])),
		);

		return this.findByLocationAndWeight(sockets, distribution, limit);
	}

	private filterWithGlobalLimit(sockets: Socket[], locations: Location[], limit: number): Socket[] {
		const weight = Math.floor(100 / locations.length);
		const distribution = new Map(locations.map(l => [l, weight]));

		return this.findByLocationAndWeight(sockets, distribution, limit);
	}

	private filterWithLocationLimit(sockets: Socket[], locations: LocationWithLimit[]): Socket[] {
		const grouped: Map<LocationWithLimit, Socket[]> = new Map();

		for (const location of locations) {
			const {limit, ...l} = location;
			const found = this.findByLocation(sockets, l);
			if (found.length > 0) {
				grouped.set(location, found);
			}
		}

		const picked: Set<Socket> = new Set();

		for (const [loc, soc] of grouped) {
			for (const s of _.sampleSize(soc, loc.limit)) {
				picked.add(s);
			}
		}

		return [...picked];
	}
}

// Factory

let router: ProbeRouter;

export const getProbeRouter = () => {
	if (!router) {
		router = new ProbeRouter(getWsServer());
	}

	return router;
};
