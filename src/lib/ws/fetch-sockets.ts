import config from 'config';
import { throttle, LRUOptions } from './helper/throttle.js';
import { fetchRawSockets, RemoteProbeSocket } from './server.js';
import { type AdoptedProbe, adoptedProbes } from '../adopted-probes.js';
import { getIndex } from '../../probe/builder.js';
import type { ProbeLocation } from '../../probe/types.js';
import { normalizePublicName } from '../geoip/utils.js';

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

		const newLocation: ProbeLocation = isCustomCity ? {
			...connected.data.probe.location,
			city: adopted.city!,
			normalizedCity: normalizePublicName(adopted.city!),
			latitude: adopted.latitude!,
			longitude: adopted.longitude!,
		} : connected.data.probe.location;

		const newTags = adopted.tags && adopted.tags.length ? [
			...connected.data.probe.tags,
			...adopted.tags.map(tag => ({ type: 'user' as const, value: `u-baderfall-${tag}` })),
		] : connected.data.probe.tags;

		const result = {
			...connected,
			data: {
				...connected.data,
				probe: {
					...connected.data.probe,
					location: newLocation,
					tags: newTags,
					index: getIndex(newLocation, newTags),
				} },
		} as RemoteProbeSocket;
		// We need to copy prototype to the 'result' object, to methods like 'disconnect' are available
		Object.setPrototypeOf(result, Object.getPrototypeOf(connected) as object);

		return result;
	});
};

export const fetchSockets = async (options?: LRUOptions) => {
	const sockets = await throttledFetchSockets(options);
	return sockets;
};

export type ThrottledFetchSockets = typeof fetchSockets;
