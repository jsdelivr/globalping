import config from 'config';
import { scopedLogger } from '../../logger.js';
import { fetchRawSockets } from '../server.js';

const logger = scopedLogger('reconnect-probes');
const reconnectProbesDelay = config.get<number>('reconnectProbesDelay');

const TIME_UNTIL_VM_BECOMES_HEALTHY = 8000;

export const disconnectProbes = async (delay = 0) => {
	const sockets = await fetchRawSockets();

	for (const socket of sockets) {
		setTimeout(() => socket.disconnect(), Math.random() * delay);
	}
};

export const reconnectProbes = (delay = reconnectProbesDelay) => {
	if (!delay) {
		return;
	}

	setTimeout(() => {
		disconnectProbes(delay).catch(error => logger.error('Error in disconnectProbes()', error));
	}, TIME_UNTIL_VM_BECOMES_HEALTHY);
};
