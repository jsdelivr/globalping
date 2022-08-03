import {Server} from 'socket.io';
import {createAdapter} from '@socket.io/redis-adapter';
import type {DefaultEventsMap} from 'socket.io/dist/typed-events';
import type {Probe} from '../../probe/types.js';
import {createRedisClient} from '../redis/client.js';

export type SocketData = {
	probe: Probe;
};

export type WsServer = Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, SocketData>;

// eslint-disable-next-line @typescript-eslint/naming-convention
export const PROBES_NAMESPACE = '/probes';

let io: WsServer;

export const initWsServer = async () => {
	const pubClient = await createRedisClient();
	const subClient = await createRedisClient();

	await Promise.all([pubClient, subClient]);

	io = new Server({
		transports: ['websocket'],
		serveClient: false,
		pingInterval: 10_000,
		pingTimeout: 4000,
	});

	io.adapter(createAdapter(pubClient, subClient));
};

export const getWsServer = (): WsServer => {
	if (!io) {
		throw new Error('WS server not initialized yet');
	}

	return io;
};
