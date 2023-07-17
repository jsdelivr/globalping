import * as process from 'node:process';
import { fetchSockets } from '../server.js';
import { scopedLogger } from '../../logger.js';
import { InternalError } from '../../internal-error.js';

const logger = scopedLogger('ws:limit');

export const verifyIpLimit = async (ip: string, socketId: string): Promise<void> => {
	if (process.env['FAKE_PROBE_IP']) {
		return;
	}

	const socketList = await fetchSockets();
	const previousSocket = socketList.find(s => s.data.probe.ipAddress === ip && s.id !== socketId);

	if (previousSocket) {
		logger.info(`ws client ${socketId} has reached the concurrent IP limit.`, { message: previousSocket.data.probe.ipAddress });
		throw new InternalError('ip limit', true);
	}
};
