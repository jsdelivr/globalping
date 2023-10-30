import config from 'config';
import { throttle, LRUOptions } from './helper/throttle.js';
import { fetchRawSockets, RemoteProbeSocket } from './server.js';
import { adoptedProbes } from '../adopted-probes.js';

const throttledFetchSockets = throttle<RemoteProbeSocket[]>(
	async () => {
		const connected = await fetchRawSockets();
		const adopted = adoptedProbes.getAdoptedIpToProbe();
		console.log('adopted', adopted);
		return connected;
	},
	config.get<number>('ws.fetchSocketsCacheTTL'),
);

export const fetchSockets = async (options?: LRUOptions) => {
	const sockets = await throttledFetchSockets(options);
	return sockets;
};

export type ThrottledFetchSockets = typeof fetchSockets;
