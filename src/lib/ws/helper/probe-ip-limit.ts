import * as process from 'node:process';
import type {Socket} from 'socket.io';
import {getWsServer, PROBES_NAMESPACE} from '../server.js';
import {scopedLogger} from '../../logger.js';

const io = getWsServer();
const logger = scopedLogger('ws:limit');

export const verifyIpLimit = async (socket: Socket) => {
	if (process.env['FAKE_PROBE_IP']) {
		return;
	}

	const socketList = await io.of(PROBES_NAMESPACE).fetchSockets();
	const previousSocket = socketList.find(s =>
		s.data.probe.ipAddress === socket.data['probe'].ipAddress && s.id !== socket.id,
	);

	if (previousSocket) {
		socket.disconnect();
		logger.info(`ws client ${socket.id} has reached the concurrent IP limit. Disconnected.`);
	}
};
