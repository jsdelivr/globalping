import config from 'config';
import { scopedLogger } from '../../logger.js';
import type { IoContext } from '../../server.js';

const logger = scopedLogger('reconnect-probes');
const reconnectProbesDelay = config.get<number>('reconnectProbesDelay');

const TIME_UNTIL_VM_BECOMES_HEALTHY = 8000;

export const disconnectProbes = async (fetchRawSockets: IoContext['fetchRawSockets'], delay = 0) => {
	const sockets = await fetchRawSockets();

	for (const socket of sockets) {
		setTimeout(() => socket.disconnect(), Math.random() * delay);
	}
};

export const reconnectProbes = (fetchRawSockets: IoContext['fetchRawSockets'], delay = reconnectProbesDelay) => {
	if (!delay) {
		return;
	}

	setTimeout(() => {
		disconnectProbes(fetchRawSockets, delay).catch(error => logger.error('Error in disconnectProbes()', error));
	}, TIME_UNTIL_VM_BECOMES_HEALTHY);
};
