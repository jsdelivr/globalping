import _ from 'lodash';
import type { RemoteSocket } from 'socket.io';
import type { DefaultEventsMap } from 'socket.io/dist/typed-events';
import type { SocketData } from '../lib/ws/server.js';
import { fetchSockets } from '../lib/ws/server.js';
import type { LocationWithLimit } from '../measurement/types.js';
import type { Location } from '../lib/location/types.js';
import type { Probe } from './types.js';
import { SocketsLocationFilter } from './sockets-location-filter.js';

export type Socket = RemoteSocket<DefaultEventsMap, SocketData>;

export class ProbeRouter {
	constructor (
		private readonly fetchWsSockets: typeof fetchSockets,
		private readonly socketsFilter = new SocketsLocationFilter(),
	) {}

	public async findMatchingProbes (
		locations: LocationWithLimit[] = [],
		globalLimit = 1,
	): Promise<Probe[]> {
		const sockets = await this.fetchSockets();
		let filtered: Socket[] = [];

		if (locations.some(l => l.limit)) {
			filtered = this.findWithLocationLimit(sockets, locations);
		} else if (locations.length > 0) {
			filtered = this.findWithGlobalLimit(sockets, locations, globalLimit);
		} else {
			filtered = this.findGloballyDistributed(sockets, globalLimit);
		}

		return filtered.map(s => s.data.probe);
	}

	private async fetchSockets (): Promise<Socket[]> {
		const sockets = await this.fetchWsSockets();
		return sockets.filter(s => s.data.probe.status === 'ready');
	}

	private findGloballyDistributed (sockets: Socket[], limit: number): Socket[] {
		return this.socketsFilter.filterGloballyDistibuted(sockets, limit);
	}

	private findWithGlobalLimit (sockets: Socket[], locations: Location[], limit: number): Socket[] {
		const weight = Math.floor(100 / locations.length);
		const distribution = new Map(locations.map(l => [ l, weight ]));

		return this.socketsFilter.filterByLocationAndWeight(sockets, distribution, limit);
	}

	private findWithLocationLimit (sockets: Socket[], locations: LocationWithLimit[]): Socket[] {
		const grouped = new Map<LocationWithLimit, Socket[]>();

		for (const location of locations) {
			const { limit, ...l } = location; // eslint-disable-line @typescript-eslint/no-unused-vars
			const found = this.socketsFilter.filterByLocation(sockets, l);

			if (found.length > 0) {
				grouped.set(location, found);
			}
		}

		const picked = new Set<Socket>();

		for (const [ loc, soc ] of grouped) {
			for (const s of _.take(soc, loc.limit)) {
				picked.add(s);
			}
		}

		return [ ...picked ];
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
