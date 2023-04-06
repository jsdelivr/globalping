import { fetchSockets } from '../server.js';

const TIME_TO_RECONNECT_PROBES = 60_000;

export const reconnectProbes = async () => {
	const sockets = await fetchSockets();

	for (const socket of sockets) {
		setTimeout(() => socket.disconnect(), Math.random() * TIME_TO_RECONNECT_PROBES);
	}
};
