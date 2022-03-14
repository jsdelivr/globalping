import {Server} from 'socket.io';
import {createAdapter} from '@socket.io/redis-adapter';
import type {DefaultEventsMap} from 'socket.io/dist/typed-events';
import {getRedisClient} from '../redis/client.js';

export type SocketData = {
	probe: Probe;
} & Record<any, any>;

export type WSServer = Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, SocketData>;

export const PROBES_NAMESPACE = '/probes';

let io: WSServer;

export const initWsServer = async () => {
	const pubClient = getRedisClient().duplicate();
	const subClient = pubClient.duplicate();

	await Promise.all([pubClient.connect(), subClient.connect()]);

	io = new Server({
		transports: ['websocket'],
		serveClient: false,
		pingInterval: 5000,
		pingTimeout: 2000,
	});

	io.adapter(createAdapter(pubClient, subClient));
};

export const getWsServer = (): WSServer => {
	if (!io) {
		throw new Error('WS server not initialized yet');
	}

	return io;
};
