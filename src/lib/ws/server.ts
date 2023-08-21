import config from 'config';
import { type RemoteSocket, Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type { DefaultEventsMap } from 'socket.io/dist/typed-events';
import type { Probe } from '../../probe/types.js';
import { getRedisClient } from '../redis/client.js';
import { reconnectProbes } from './helper/reconnect-probes.js';
import { throttle, LRUOptions } from './helper/throttle.js';
import { scopedLogger } from '../logger.js';

export type SocketData = {
	probe: Probe;
};

export type WsServer = Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, SocketData>;

export const PROBES_NAMESPACE = '/probes';
const TIME_UNTIL_VM_BECOMES_HEALTHY = 8000;
const logger = scopedLogger('ws-server');

let io: WsServer;
let throttledFetchSockets: (options?: LRUOptions) => Promise<RemoteSocket<DefaultEventsMap, SocketData>[]>;

export const initWsServer = async () => {
	const pubClient = getRedisClient().duplicate();
	const subClient = pubClient.duplicate();

	await Promise.all([ pubClient.connect(), subClient.connect() ]);

	io = new Server({
		transports: [ 'websocket' ],
		serveClient: false,
		pingInterval: 3000,
		pingTimeout: 3000,
	});

	io.adapter(createAdapter(pubClient, subClient));

	throttledFetchSockets = throttle<Array<RemoteSocket<DefaultEventsMap, SocketData>>>(
		io.of(PROBES_NAMESPACE).fetchSockets.bind(io.of(PROBES_NAMESPACE)),
		config.get<number>('ws.fetchSocketsCacheTTL'),
	);

	setTimeout(() => {
		reconnectProbes(fetchSockets).catch(error => logger.error(error));
	}, TIME_UNTIL_VM_BECOMES_HEALTHY);
};

export const getWsServer = (): WsServer => {
	if (!io) {
		throw new Error('WS server not initialized yet');
	}

	return io;
};

export const fetchSockets = async (options?: LRUOptions) => {
	if (!io || !throttledFetchSockets) {
		throw new Error('WS server not initialized yet');
	}

	const sockets = await throttledFetchSockets(options);

	return sockets;
};

export type ThrottledFetchSockets = typeof fetchSockets;

export const fetchSocketsUntrottled = async () => {
	if (!io) {
		throw new Error('WS server not initialized yet');
	}

	const sockets = await io.of(PROBES_NAMESPACE).fetchSockets();

	return sockets;
};
