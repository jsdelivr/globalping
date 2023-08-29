import type { ThrottledFetchSockets } from '../server';

const TIME_TO_RECONNECT_PROBES = 2 * 60 * 1000;

export const reconnectProbes = async (fetchSockets: ThrottledFetchSockets) => { // passing fetchSockets in arguments to avoid cycle dependency
	const sockets = await fetchSockets();

	for (const socket of sockets) {
		setTimeout(() => socket.disconnect(), Math.random() * TIME_TO_RECONNECT_PROBES);
	}
};
