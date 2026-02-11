import _ from 'lodash';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { io, type Socket } from 'socket.io-client';
import { scopedLogger } from '../../src/lib/logger.js';
import { createServer, type IoContext } from '../../src/lib/server.js';
import { ConsoleWriter, Logger } from 'h-logger2';

let app: Server;
let url: string;
let ioContext: IoContext;

const logger = scopedLogger('test-server');

export const getTestServer = async (): Promise<Server> => {
	if (!app) {
		const result = await createServer();
		app = result.httpServer;
		ioContext = result.ioContext;
		app.listen(0);
		const { port } = app.address() as AddressInfo;
		url = `http://127.0.0.1:${port}/probes`;
		ioContext.syncedProbeList.syncInterval = 40;
		ioContext.syncedProbeList.logger.writers = [ new ConsoleWriter(Logger.levels.warn) ];
	}

	return app;
};

export const getIoContext = (): IoContext => {
	return ioContext;
};

export const addFakeProbe = async (events: object = {}, options: object = {}): Promise<Socket> => {
	return (await addFakeProbes(1, events, options))[0]!;
};

export const addFakeProbes = async (count: number, events: object = {}, options: object = {}): Promise<Socket[]> => {
	const { syncedProbeList } = ioContext;

	return new Promise((resolve) => {
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
					version: '0.39.0',
					nodeVersion: 'v18.17.0',
					uuid: '1-1-1-1-1',
					isHardware: 'undefined',
					hardwareDevice: 'undefined',
					hardwareDeviceFirmware: 'undefined',
					totalMemory: 1e9,
					totalDiskSize: 2e3,
					availableDiskSpace: 1e3,
				},
			}, options));

			for (const [ event, listener ] of Object.entries(events)) {
				client.on(event, listener);
			}

			client.on('connect_error', (error: Error) => logger.error('Client connect error.', error));

			client.on('connect', () => {
				resolve(client);
			});
		})));
	});
};

export const deleteFakeProbes = async (socketsToDelete?: Socket[]): Promise<void> => {
	const { syncedProbeList, fetchRawSockets } = ioContext;

	if (!syncedProbeList) {
		return;
	}

	const sockets = socketsToDelete?.length ? socketsToDelete : await fetchRawSockets();

	for (const socket of sockets) {
		socket.disconnect(true);
	}

	return new Promise<void>((resolve) => {
		const checker = () => {
			if (syncedProbeList.getProbes().length === 0) {
				setTimeout(resolve, syncedProbeList.syncInterval);
				syncedProbeList.off(syncedProbeList.localUpdateEvent, checker);
			}
		};

		syncedProbeList.on(syncedProbeList.localUpdateEvent, checker);
	});
};

export const waitForProbesUpdate = async (): Promise<void> => {
	await ioContext.syncedProbeList.fetchProbes();
};
