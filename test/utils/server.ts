import type {Server} from 'node:http';
import {type AddressInfo} from 'node:net';
import _ from 'lodash';
import {io, type Socket} from 'socket.io-client';
import {createServer} from '../../src/lib/server.js';

let app: Server;
let url: string;

export const getTestServer = async (): Promise<Server> => {
	// eslint-disable-next-line @typescript-eslint/ban-types
	_.throttle = ((func: Function) => func) as unknown as typeof _.throttle;

	if (!app) {
		app = await createServer();
		app.listen(0);
		const {port} = app.address() as AddressInfo;
		url = `http://127.0.0.1:${port}/probes`;
	}

	return app;
};

export const addFakeProbe = async (events: Record<string, any> = {}): Promise<Socket> => {
	const socket = await new Promise<Socket>(resolve => {
		const client = io(url, {
			transports: ['websocket'],
			reconnectionDelay: 100,
			reconnectionDelayMax: 500,
			query: {
				version: '0.14.0',
			},
		});
		for (const [event, listener] of Object.entries(events)) {
			client.on(event, listener);
		}

		client.on('connect', () => {
			resolve(client);
		});
	});
	return socket;
};

export const deleteFakeProbe = async (probe: Socket): Promise<void> => {
	probe.disconnect();
};
