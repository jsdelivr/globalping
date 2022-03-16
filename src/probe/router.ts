import _ from 'lodash';
import type {RemoteSocket} from 'socket.io';
import type {DefaultEventsMap} from 'socket.io/dist/typed-events';
import type {SocketData, WsServer} from '../lib/ws/server.js';
import {getWsServer, PROBES_NAMESPACE} from '../lib/ws/server.js';
import type {LocationWithLimit} from '../measurement/types.js';
import type {Location} from '../lib/location/location.js';
import type {Probe} from './types.js';

type Socket = RemoteSocket<DefaultEventsMap, SocketData>;

export class ProbeRouter {
	constructor(
		private readonly io: WsServer,
		private readonly sampleFn: typeof _.sampleSize,
	) {}

	async findMatchingProbes(locations: LocationWithLimit[], globalLimit: number | undefined = undefined): Promise<Probe[]> {
		const sockets = await this.fetchSockets();
		let filtered: Socket[];

		if (locations.length === 0 && !globalLimit) {
			filtered = sockets;
		} else if (locations.length === 0) {
			filtered = this.filterGloballyDistributed(sockets, globalLimit!);
		} else if (globalLimit) {
			filtered = this.filterWithGlobalLimit(sockets, locations, globalLimit);
		} else {
			filtered = this.filterWithLocationLimit(sockets, locations);
		}

		return filtered.map(s => s.data.probe);
	}

	private async fetchSockets(): Promise<Socket[]> {
		return this.io.of(PROBES_NAMESPACE).fetchSockets();
	}

	private filterGloballyDistributed(sockets: Socket[], limit: number): Socket[] {
		return this.sampleFn(sockets, limit);
	}

	private filterWithGlobalLimit(sockets: Socket[], locations: Location[], limit: number): Socket[] {
		const filtered: Set<Socket> = new Set();

		for (const loc of locations) {
			for (const socket of sockets) {
				const {probe} = socket.data;

				if (!probe) {
					continue;
				}

				if (probe.location[loc.type] === loc.value as unknown) {
					filtered.add(socket);
				}
			}
		}

		return this.sampleFn([...filtered.values()], limit);
	}

	private filterWithLocationLimit(sockets: Socket[], locations: LocationWithLimit[]): Socket[] {
		const filtered: Socket[] = [];

		// Todo: O(N*M) - see if we can do it better
		for (const loc of locations) {
			const temporary = [];
			for (const socket of sockets) {
				const {probe} = socket.data;

				if (!probe || filtered.includes(socket)) {
					continue;
				}

				if (probe.location[loc.type] && probe.location[loc.type] === loc.value as unknown) {
					temporary.push(socket);
				}
			}

			filtered.push(...(this.sampleFn(temporary, loc.limit)));
		}

		return filtered;
	}
}

// Factory

let router: ProbeRouter;

export const getProbeRouter = () => {
	if (!router) {
		router = new ProbeRouter(getWsServer(), _.sampleSize);
	}

	return router;
};
