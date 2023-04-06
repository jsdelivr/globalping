import * as process from 'node:process';
import type { Socket } from 'socket.io';
import type { Probe } from '../../../probe/types.js';
import { WsError } from '../ws-error.js';
import { fetchSockets } from '../server.js';
import { scopedLogger } from '../../logger.js';

const logger = scopedLogger('ws:limit');

export const verifyIpLimit = async (socket: Socket): Promise<void> => {
	if (process.env['FAKE_PROBE_IP']) {
		return;
	}

	const probe = socket.data['probe'] as Probe;

	const socketList = await fetchSockets();
	const previousSocket = socketList.find(s => s.data.probe.ipAddress === probe.ipAddress && s.id !== socket.id);

	if (previousSocket) {
		logger.info(`ws client ${socket.id} has reached the concurrent IP limit.`, { message: previousSocket.data.probe.ipAddress });
		throw new WsError(
			'IP Limit',
			{
				code: 'ip_limit',
				socketId: socket.id,
				probe,
				ipAddress: probe.ipAddress,
			},
		);
	}
};
