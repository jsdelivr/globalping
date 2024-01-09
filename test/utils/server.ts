import _ from 'lodash';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { io, type Socket } from 'socket.io-client';
import { scopedLogger } from '../../src/lib/logger.js';
import { createServer } from '../../src/lib/server.js';
import { fetchRawSockets } from '../../src/lib/ws/server.js';

let app: Server;
let url: string;

const logger = scopedLogger('test-server');

export const getTestServer = async (): Promise<Server> => {
	if (!app) {
		app = await createServer();
		app.listen(0);
		const { port } = app.address() as AddressInfo;
		url = `http://127.0.0.1:${port}/probes`;
	}

	return app;
};

export const addFakeProbe = async (events: object = {}, options: object = {}): Promise<Socket> => {
	const socket = await new Promise<Socket>((resolve) => {
		const client = io(url, _.merge({
			transports: [ 'websocket' ],
			reconnectionDelay: 100,
			reconnectionDelayMax: 500,
			query: {
				version: '0.14.0',
				nodeVersion: 'v18.17.0',
				uuid: '1-1-1-1-1',
				isHardware: 'undefined',
				hardwareDevice: 'undefined',
			},
		}, options));

		for (const [ event, listener ] of Object.entries(events)) {
			client.on(event, listener);
		}

		client.on('connect_error', (error: Error) => logger.error(error));

		client.on('connect', () => {
			resolve(client);
		});
	});
	return socket;
};

export const deleteFakeProbe = async (): Promise<void> => {
	const sockets = await fetchRawSockets();

	for (const socket of sockets) {
		socket.disconnect(true);
	}
};
