import {Server} from 'socket.io';
import {createAdapter} from '@socket.io/redis-adapter';
import {getRedisClient} from '../redis/client.js';

let io: Server;

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

export const getWsServer = (): Server => {
	if (!io) {
		throw new Error('WS server not initialized yet');
	}

	return io;
};
