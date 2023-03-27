import * as process from 'node:process';
import type { Socket } from 'socket.io';
import type { Probe } from '../../../probe/types.js';
import { WsError } from '../ws-error.js';
import { getWsServer, PROBES_NAMESPACE } from '../server.js';
import { scopedLogger } from '../../logger.js';

const io = getWsServer();
const logger = scopedLogger('ws:limit');

export const verifyIpLimit = async (socket: Socket): Promise<void> => {
	if (process.env['FAKE_PROBE_IP']) {
		return;
	}

	const socketList = await io.of(PROBES_NAMESPACE).fetchSockets();
	const previousSocket = socketList.find(s => s.data.probe.ipAddress === socket.data['probe'].ipAddress && s.id !== socket.id);

	if (previousSocket) {
		logger.info(`ws client ${socket.id} has reached the concurrent IP limit.`, { message: previousSocket.data.probe.ipAddress });
		throw new WsError(
			'IP Limit',
			{
				code: 'ip_limit',
				socketId: socket.id,
				probe: socket.data['probe'] as Probe,
				ipAddress: socket.data['probe'].ipAddress as Probe['ipAddress'],
			},
		);
	}
};
