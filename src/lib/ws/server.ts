import { Namespace, type RemoteSocket, Server, Socket } from 'socket.io';
import { createShardedAdapter } from '@socket.io/redis-adapter';
// eslint-disable-next-line n/no-missing-import
import type { DefaultEventsMap } from 'socket.io/dist/typed-events.js';
import type { Probe } from '../../probe/types.js';
import { getRedisClient } from '../redis/client.js';
import { SyncedProbeList } from './synced-probe-list.js';
import { client } from '../sql/client.js';
import { AdoptedProbes } from '../adopted-probes.js';
import { ProbeIpLimit } from './helper/probe-ip-limit.js';

export type SocketData = {
	probe: Probe;
};

export type RemoteProbeSocket = RemoteSocket<DefaultEventsMap, SocketData>;

export type ServerSocket = Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, SocketData>;

export type WsServer = Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, SocketData>;

export type WsServerNamespace = Namespace<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, SocketData>;

export const PROBES_NAMESPACE = '/probes';

let io: WsServer;
let syncedProbeList: SyncedProbeList;

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

	syncedProbeList = new SyncedProbeList(io.of(PROBES_NAMESPACE), adoptedProbes);

	await syncedProbeList.sync();
	syncedProbeList.scheduleSync();
};

export const getWsServer = (): WsServer => {
	if (!io) {
		throw new Error('WS server not initialized yet');
	}

	return io;
};

export const getSyncedProbeList = (): SyncedProbeList => {
	if (!syncedProbeList) {
		throw new Error('SyncedProbeList not initialized yet');
	}

	return syncedProbeList;
};

export const fetchRawSockets = async () => {
	if (!io) {
		throw new Error('WS server not initialized yet');
	}

	return io.of(PROBES_NAMESPACE).fetchSockets();
};

export const fetchProbes = async ({ allowStale = true } = {}): Promise<Probe[]> => {
	if (!syncedProbeList) {
		throw new Error('WS server not initialized yet');
	}

	return allowStale ? syncedProbeList.getProbes() : syncedProbeList.fetchProbes();
};

export const fetchRawProbes = async (): Promise<Probe[]> => {
	if (!syncedProbeList) {
		throw new Error('WS server not initialized yet');
	}

	return syncedProbeList.getRawProbes();
};

export const adoptedProbes = new AdoptedProbes(client, fetchRawProbes);

export const probeIpLimit = new ProbeIpLimit(fetchProbes, fetchRawSockets);
