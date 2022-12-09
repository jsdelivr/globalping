/* eslint-disable @typescript-eslint/naming-convention */
import _ from 'lodash';
import {RemoteSocket, Server} from 'socket.io';
import {createAdapter} from '@socket.io/redis-adapter';
import type {DefaultEventsMap} from 'socket.io/dist/typed-events';
import type {Probe} from '../../probe/types.js';
import {getRedisClient} from '../redis/client.js';
import {reconnectProbes} from './helper/reconnect-probes.js';

export type SocketData = {
	probe: Probe;
};

export type WsServer = Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, SocketData>;

export const PROBES_NAMESPACE = '/probes';
const TIME_UNTIL_VM_BECOMES_HEALTHY = 8000;
const TIME_TO_CACHE_FETCH_SOCKETS = 200;

let io: WsServer;
let throttledFetchSockets: _.DebouncedFunc<() => Promise<Array<RemoteSocket<DefaultEventsMap, SocketData>>>>;

export const initWsServer = async () => {
	const pubClient = getRedisClient().duplicate();
	const subClient = pubClient.duplicate();

	await Promise.all([pubClient.connect(), subClient.connect()]);

	io = new Server({
		transports: ['websocket'],
		serveClient: false,
		pingInterval: 10_000,
		pingTimeout: 4000,
	});

	io.adapter(createAdapter(pubClient, subClient));

	throttledFetchSockets = _.throttle(io.of(PROBES_NAMESPACE).fetchSockets.bind(io.of(PROBES_NAMESPACE)), TIME_TO_CACHE_FETCH_SOCKETS);

	setTimeout(() => reconnectProbes(io), TIME_UNTIL_VM_BECOMES_HEALTHY);
};

export const getWsServer = (): WsServer => {
	if (!io) {
		throw new Error('WS server not initialized yet');
	}

	return io;
};

export const fetchSockets = () => {
	if (!io || !throttledFetchSockets) {
		throw new Error('WS server not initialized yet');
	}

	const sockets = throttledFetchSockets();

	if (sockets === undefined) {
		throw new Error('undefined, the debounced function was not invoked yet');
	}

	return sockets;
};
