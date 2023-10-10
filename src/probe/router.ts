import _ from 'lodash';
import type { RemoteProbeSocket } from '../lib/ws/server.js';
import { fetchSockets } from '../lib/ws/server.js';
import type { LocationWithLimit } from '../measurement/types.js';
import type { Location } from '../lib/location/types.js';
import type { Probe } from './types.js';
import { SocketsLocationFilter } from './sockets-location-filter.js';

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
		let filtered: RemoteProbeSocket[] = [];

		if (locations.some(l => l.limit)) {
			filtered = this.findWithLocationLimit(sockets, locations);
		} else if (locations.length > 0) {
			filtered = this.findWithGlobalLimit(sockets, locations, globalLimit);
		} else {
			filtered = this.findGloballyDistributed(sockets, globalLimit);
		}

		return filtered.map(s => s.data.probe);
	}

	private async fetchSockets (): Promise<RemoteProbeSocket[]> {
		const sockets = await this.fetchWsSockets();
		return sockets.filter(s => s.data.probe.status === 'ready');
	}

	private findGloballyDistributed (sockets: RemoteProbeSocket[], limit: number): RemoteProbeSocket[] {
		return this.socketsFilter.filterGloballyDistibuted(sockets, limit);
	}

	private findWithGlobalLimit (sockets: RemoteProbeSocket[], locations: Location[], limit: number): RemoteProbeSocket[] {
		const weight = Math.floor(100 / locations.length);
		const distribution = new Map(locations.map(l => [ l, weight ]));

		return this.socketsFilter.filterByLocationAndWeight(sockets, distribution, limit);
	}

	private findWithLocationLimit (sockets: RemoteProbeSocket[], locations: LocationWithLimit[]): RemoteProbeSocket[] {
		const grouped = new Map<LocationWithLimit, RemoteProbeSocket[]>();

		for (const location of locations) {
			const { limit, ...l } = location;
			const found = this.socketsFilter.filterByLocation(sockets, l);

			if (found.length > 0) {
				grouped.set(location, found);
			}
		}

		const picked = new Set<RemoteProbeSocket>();

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
