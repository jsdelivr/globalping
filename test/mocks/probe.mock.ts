import type {AddressInfo} from 'node:net';
import {io} from 'socket.io-client';
import {getTestServer} from '../utils/http.js';

export const createFakeProbeServer = async (ipAddress = '100.10.10.1') => {
	const server = await getTestServer();
	const addressInfo = server.address() as AddressInfo;

	const socket = io(`ws://127.0.0.1:${addressInfo.port}/probes`, {
		transports: ['websocket'],
		extraHeaders: {
			'X-Client-IP': ipAddress,
		},
	});

	await new Promise((resolve, reject) => {
		setTimeout(() => {
			reject();
		}, 10_000);

		socket.on('connect', () => {
			resolve(true);
		});
	});

	return socket;
};
