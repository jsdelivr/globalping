import config from 'config';
import { scopedLogger } from '../../logger.js';
import { fetchRawSockets } from '../server.js';

const logger = scopedLogger('reconnect-probes');
const reconnectProbesDelay = config.get<number>('reconnectProbesDelay');

const TIME_UNTIL_VM_BECOMES_HEALTHY = 8000;

const disconnectProbes = async () => {
	const sockets = await fetchRawSockets();

	for (const socket of sockets) {
		setTimeout(() => socket.disconnect(), Math.random() * reconnectProbesDelay);
	}
};

export const reconnectProbes = () => {
	if (!reconnectProbesDelay || (reconnectProbesDelay as unknown as string) === '0') {
		return;
	}

	setTimeout(() => {
		disconnectProbes().catch(error => logger.error(error));
	}, TIME_UNTIL_VM_BECOMES_HEALTHY);
};
