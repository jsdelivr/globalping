import config from 'config';
import { throttle, LRUOptions } from './helper/throttle.js';
import { fetchRawSockets, RemoteProbeSocket } from './server.js';
import { adoptedProbes } from '../adopted-probes.js';
import { getIndex } from '../../probe/builder.js';

const throttledFetchSockets = throttle<RemoteProbeSocket[]>(
	async () => {
		const sockets = await fetchRawSockets();
		const withAdoptedData = addAdoptedProbesData(sockets);
		return withAdoptedData;
	},
	config.get<number>('ws.fetchSocketsCacheTTL'),
);

const addAdoptedProbesData = (sockets: RemoteProbeSocket[]) => {
	return sockets.map((socket) => {
		const adopted = adoptedProbes.getByIp(socket.data.probe.ipAddress);

		if (!adopted) {
			return socket;
		}

		const isCustomCity = adopted.isCustomCity;
		const hasUserTags = adopted.tags && adopted.tags.length > 0;

		if (!isCustomCity && !hasUserTags) {
			return socket;
		}

		const newLocation = adoptedProbes.getUpdatedLocation(socket.data.probe);

		const newTags = adoptedProbes.getUpdatedTags(socket.data.probe);

		const result = {
			...socket,
			data: {
				...socket.data,
				probe: {
					...socket.data.probe,
					location: newLocation,
					tags: newTags,
					index: getIndex(newLocation, newTags),
				},
			},
		} as RemoteProbeSocket;

		// We need to copy prototype to the 'result' object, so socket methods like 'disconnect' are available
		Object.setPrototypeOf(result, Object.getPrototypeOf(socket) as object);

		return result;
	});
};

export const fetchSockets = async (options?: LRUOptions) => {
	const sockets = await throttledFetchSockets(options);
	return sockets;
};

export type ThrottledFetchSockets = typeof fetchSockets;
