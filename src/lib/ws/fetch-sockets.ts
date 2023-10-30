import config from 'config';
import { throttle, LRUOptions } from './helper/throttle.js';
import { fetchConnectedSockets, RemoteProbeSocket } from './server.js';
import { adoptedProbes } from '../adopted-probes.js';

const throttledFetchSockets = throttle<RemoteProbeSocket[]>(
	async () => {
		const connected = await fetchConnectedSockets();
		const adopted = adoptedProbes.getAdoptedIpToProbe();
		console.log('adopted', adopted.size);
		return connected;
	},
	config.get<number>('ws.fetchSocketsCacheTTL'),
);

export const fetchSockets = async (options?: LRUOptions) => {
	if (!throttledFetchSockets) {
		throw new Error('throttledFetchSockets not initialized yet');
	}

	const sockets = await throttledFetchSockets(options);

	return sockets;
};

export type ThrottledFetchSockets = typeof fetchSockets;
