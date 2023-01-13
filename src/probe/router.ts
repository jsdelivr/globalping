import _ from 'lodash';
import config from 'config';
import type {RemoteSocket} from 'socket.io';
import type {DefaultEventsMap} from 'socket.io/dist/typed-events';
import type {SocketData} from '../lib/ws/server.js';
import {fetchSockets} from '../lib/ws/server.js';
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
	static hasIndex(socket: Socket, index: string) {
		return socket.data.probe.index.some(v => v.includes(index.replace('-', ' ').trim()));
	}

	static hasTag(socket: Socket, tag: string) {
		return socket.data.probe.tags.some(({type, value}) => type === 'system' && value.includes(tag.trim()));
	}

	static hasTagStrict(socket: Socket, tag: string) {
		return socket.data.probe.tags.some(({type, value}) => type === 'system' && value === tag);
	}

	constructor(
		private readonly fetchWsSockets: typeof fetchSockets,
	) {}

	public async findMatchingProbes(
		locations: LocationWithLimit[] = [],
		globalLimit = 1,
	): Promise<Probe[]> {
		const sockets = await this.fetchSockets();
		let filtered: Socket[] = [];

		if (locations.some(l => l.limit)) {
			filtered = this.filterWithLocationLimit(sockets, locations);
		} else if (locations.length > 0) {
			filtered = this.filterWithGlobalLimit(sockets, locations, globalLimit);
		} else {
			filtered = this.filterGloballyDistributed(sockets, globalLimit);
		}

		return filtered.map(s => s.data.probe);
	}

	private async fetchSockets(): Promise<Socket[]> {
		const sockets = await this.fetchWsSockets();
		return sockets.filter(s => s.data.probe.ready);
	}

	private findByLocation(sockets: Socket[], location: Location): Socket[] {
		if (location.magic === 'world') {
			return this.filterGloballyDistributed(sockets, sockets.length);
		}

		return sockets.filter(s => Object.keys(location).every(k => {
			if (k === 'tags') {
				const tags = location[k]!;
				return tags.every(tag => ProbeRouter.hasTagStrict(s, tag));
			}

			if (k === 'magic') {
				const keywords = String(location[k]).split('+');
				return keywords.every(keyword => ProbeRouter.hasIndex(s, keyword) || ProbeRouter.hasTag(s, keyword));
			}

			const key = locationKeyMap.find(m => m.includes(k))?.[1] ?? k;

			return location[k as keyof Location] === s.data.probe.location[key as keyof ProbeLocation];
		}));
	}

	private findByLocationAndWeight(sockets: Socket[], distribution: Map<Location, number>, limit: number): Socket[] {
		const groupedByLocation = new Map<Location, Socket[]>();

		for (const [location] of distribution) {
			const foundSockets = _.shuffle(this.findByLocation(sockets, location));
			if (foundSockets.length > 0) {
				groupedByLocation.set(location, foundSockets);
			}
		}

		const pickedSockets = new Set<Socket>();

		while (groupedByLocation.size > 0 && pickedSockets.size < limit) {
			const selectedCount = pickedSockets.size;

			for (const [location, locationSockets] of groupedByLocation) {
				if (pickedSockets.size === limit) {
					break;
				}

				const locationWeight = distribution.get(location);

				if (!locationWeight) {
					continue;
				}

				const count = Math.ceil((limit - selectedCount) * locationWeight / 100);

				for (const s of locationSockets.splice(0, count)) {
					pickedSockets.add(s);
				}

				if (locationSockets.length === 0) {
					groupedByLocation.delete(location);
				}
			}
		}

		return [...pickedSockets];
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
		const grouped = new Map<LocationWithLimit, Socket[]>();

		for (const location of locations) {
			const {limit, ...l} = location;
			const found = _.shuffle(this.findByLocation(sockets, l));
			if (found.length > 0) {
				grouped.set(location, found);
			}
		}

		const picked = new Set<Socket>();

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
		router = new ProbeRouter(fetchSockets);
	}

	return router;
};
