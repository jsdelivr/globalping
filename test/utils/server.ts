import _ from 'lodash';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { io, type Socket } from 'socket.io-client';
import { scopedLogger } from '../../src/lib/logger.js';
import { createServer } from '../../src/lib/server.js';
import { fetchRawSockets, getSyncedProbeList } from '../../src/lib/ws/server.js';

let app: Server;
let url: string;

const logger = scopedLogger('test-server');

export const getTestServer = async (): Promise<Server> => {
	if (!app) {
		app = await createServer();
		app.listen(0);
		const { port } = app.address() as AddressInfo;
		url = `http://127.0.0.1:${port}/probes`;
		getSyncedProbeList().syncInterval = 40;
		getSyncedProbeList().syncTimeout = 200;
	}

	return app;
};

export const addFakeProbe = async (events: object = {}, options: object = {}): Promise<Socket> => {
	return (await addFakeProbes(1, events, options))[0]!;
};

export const addFakeProbes = async (count: number, events: object = {}, options: object = {}): Promise<Socket[]> => {
	return new Promise((resolve) => {
		const syncedProbeList = getSyncedProbeList();
		const probeCount = syncedProbeList.getProbes().length;

		const checker = () => {
			if (syncedProbeList.getProbes().length >= probeCount + count) {
				resolve(socketsPromise);
				syncedProbeList.off(syncedProbeList.localUpdateEvent, checker);
			}
		};

		syncedProbeList.on(syncedProbeList.localUpdateEvent, checker);

		const socketsPromise = Promise.all(Array.from({ length: count }).map(() => new Promise<Socket>((resolve) => {
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
					totalMemory: 1e9,
					totalDiskSize: 2e3,
					availableDiskSpace: 1e3,
				},
			}, options));

			for (const [ event, listener ] of Object.entries(events)) {
				client.on(event, listener);
			}

			client.on('connect_error', (error: Error) => logger.error(error));

			client.on('connect', () => {
				resolve(client);
			});
		})));
	});
};

export const deleteFakeProbes = async (): Promise<void> => {
	const sockets = await fetchRawSockets();

	for (const socket of sockets) {
		socket.disconnect(true);
	}

	return new Promise<void>((resolve) => {
		const syncedProbeList = getSyncedProbeList();

		const checker = () => {
			if (syncedProbeList.getProbes().length === 0) {
				setTimeout(resolve, syncedProbeList.syncTimeout);
				syncedProbeList.off(syncedProbeList.localUpdateEvent, checker);
			}
		};

		syncedProbeList.on(syncedProbeList.localUpdateEvent, checker);
	});
};

export const waitForProbesUpdate = async (): Promise<void> => {
	await getSyncedProbeList().fetchProbes();
};
