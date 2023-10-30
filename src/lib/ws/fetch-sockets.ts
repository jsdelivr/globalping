import config from 'config';
import { throttle, LRUOptions } from './helper/throttle.js';
import { fetchRawSockets, RemoteProbeSocket } from './server.js';
import { type AdoptedProbe, adoptedProbes } from '../adopted-probes.js';

const throttledFetchSockets = throttle<RemoteProbeSocket[]>(
	async () => {
		const connected = await fetchRawSockets();
		const adopted = adoptedProbes.getAdoptedIpToProbe();
		const withAdoptedData = addAdoptedProbesData(connected, adopted);
		return withAdoptedData;
	},
	config.get<number>('ws.fetchSocketsCacheTTL'),
);

const addAdoptedProbesData = (connectedProbes: RemoteProbeSocket[], AdoptedIpToProbe: Map<string, AdoptedProbe>) => {
	return connectedProbes.map((connected) => {
		const ip = connected.data.probe.ipAddress;
		const adopted = AdoptedIpToProbe.get(ip);

		if (!adopted) {
			return connected;
		}

		const isCustomCity = adopted.isCustomCity;
		const hasUserTags = adopted.tags && adopted.tags.length;

		if (!isCustomCity && !hasUserTags) {
			return connected;
		}

		const result = {
			...connected,
			data: {
				...connected.data,
				probe: {
					...connected.data.probe,
					...(isCustomCity && {
						location: {
							...connected.data.probe.location,
							city: adopted.city!,
							latitude: adopted.latitude!,
							longitude: adopted.longitude!,
						},
					}),
					...((adopted.tags && adopted.tags.length) && {
						tags: [
							...connected.data.probe.tags,
							...adopted.tags.map(tag => ({ type: 'user' as const, value: `u-baderfall-${tag}` })),
						],
					}),
				} },
		} as RemoteProbeSocket;

		// TODO: Update index here

		return result;
	});
};

export const fetchSockets = async (options?: LRUOptions) => {
	const sockets = await throttledFetchSockets(options);
	return sockets;
};

export type ThrottledFetchSockets = typeof fetchSockets;
