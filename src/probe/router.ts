import _ from 'lodash';
import type {RemoteSocket} from 'socket.io';
import type {DefaultEventsMap} from 'socket.io/dist/typed-events';
import type {SocketData, WsServer} from '../lib/ws/server.js';
import {getWsServer, PROBES_NAMESPACE} from '../lib/ws/server.js';
import type {LocationWithLimit} from '../measurement/types.js';
import type {Location} from '../lib/location/types.js';
import type {Probe} from './types.js';

type Socket = RemoteSocket<DefaultEventsMap, SocketData>;

export class ProbeRouter {
	constructor(
		private readonly io: WsServer,
		private readonly sampleFn: typeof _.sampleSize,
	) {}

	async findMatchingProbes(locations: LocationWithLimit[] = [], globalLimit: number | undefined = undefined): Promise<Probe[]> {
		const sockets = await this.fetchSockets();
		let filtered: Socket[] = [];

		if (globalLimit) {
			filtered = locations.length > 0 ? this.filterWithGlobalLimit(sockets, locations, globalLimit) : this.filterGloballyDistributed(sockets, globalLimit);
		} else if (locations.length > 0) {
			filtered = this.filterWithLocationLimit(sockets, locations);
		}

		return filtered.map(s => s.data.probe);
	}

	private async fetchSockets(): Promise<Socket[]> {
		return this.io.of(PROBES_NAMESPACE).fetchSockets();
	}

	private findByLocation(sockets: Socket[], location: Location): Socket[] {
		return sockets.filter(s => s.data.probe.location[location.type] === location.value);
	}

	private filterGloballyDistributed(sockets: Socket[], limit: number): Socket[] {
		const distribution = {
			// eslint-disable-next-line @typescript-eslint/naming-convention
			AF: 5, AS: 15, EU: 30, OC: 10, NA: 30, SA: 10, AN: 0,
		};

		const grouped = Object.fromEntries(
			Object
				.keys(distribution)
				.map<[string, Socket[]]>(value => [value, _.shuffle(this.findByLocation(sockets, {type: 'continent', value}))])
				.filter(([, v]) => v && v.length > 0),
		);

		const picked: Set<Socket> = new Set();

		while (Object.keys(grouped).length > 0 && picked.size < limit) {
			const selectedCount = picked.size;

			for (const [k, v] of Object.entries(grouped)) {
				const weight = distribution[k as never];
				const count = Math.ceil((limit - selectedCount) * weight / 100);

				for (const s of v.splice(0, count)) {
					picked.add(s);
				}

				if (v.length === 0) {
					// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
					delete grouped[k];
				}
			}
		}

		return [...picked];
	}

	private filterWithGlobalLimit(sockets: Socket[], locations: Location[], limit: number): Socket[] {
		const filtered: Set<Socket> = new Set();

		for (const loc of locations) {
			for (const s of this.findByLocation(sockets, loc)) {
				filtered.add(s);
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
