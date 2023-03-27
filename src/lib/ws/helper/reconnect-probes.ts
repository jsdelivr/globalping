import { PROBES_NAMESPACE, type WsServer } from '../server.js';

const TIME_TO_RECONNECT_PROBES = 60_000;

export const reconnectProbes = async (io: WsServer) => {
	const sockets = await io.of(PROBES_NAMESPACE).fetchSockets();

	for (const socket of sockets) {
		setTimeout(() => socket.disconnect(), Math.random() * TIME_TO_RECONNECT_PROBES);
	}
};
