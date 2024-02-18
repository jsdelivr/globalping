import { type RemoteSocket, Server, Socket } from 'socket.io';
import { createShardedAdapter } from '@socket.io/redis-adapter';
// eslint-disable-next-line n/no-missing-import
import type { DefaultEventsMap } from 'socket.io/dist/typed-events.js';
import type { Probe } from '../../probe/types.js';
import { getRedisClient } from '../redis/client.js';

export type SocketData = {
	probe: Probe;
};

export type RemoteProbeSocket = RemoteSocket<DefaultEventsMap, SocketData>;

export type ServerSocket = Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, SocketData>;

export type WsServer = Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, SocketData>;

export const PROBES_NAMESPACE = '/probes';

let io: WsServer;

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

	io.adapter(createShardedAdapter(pubClient, subClient, {
		subscriptionMode: 'dynamic',
		dynamicPrivateChannels: true,
	}));
};

export const getWsServer = (): WsServer => {
	if (!io) {
		throw new Error('WS server not initialized yet');
	}

	return io;
};

export const fetchRawSockets = async () => {
	if (!io) {
		throw new Error('WS server not initialized yet');
	}

	const sockets = await io.of(PROBES_NAMESPACE).fetchSockets();

	return sockets;
};
