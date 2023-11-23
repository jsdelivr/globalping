import { scopedLogger } from '../../logger.js';
import { fetchSockets } from '../fetch-sockets.js';

const logger = scopedLogger('reconnect-probes');

const TIME_UNTIL_VM_BECOMES_HEALTHY = 8000;
const TIME_TO_RECONNECT_PROBES = 2 * 60 * 1000;

const disconnectProbes = async () => {
	const sockets = await fetchSockets();

	for (const socket of sockets) {
		setTimeout(() => socket.disconnect(), Math.random() * TIME_TO_RECONNECT_PROBES);
	}
};

export const reconnectProbes = () => {
	setTimeout(() => {
		disconnectProbes().catch(error => logger.error(error));
	}, TIME_UNTIL_VM_BECOMES_HEALTHY);
};
