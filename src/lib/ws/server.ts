import { Namespace, type RemoteSocket, Server, Socket } from 'socket.io';
import { createShardedAdapter } from '@socket.io/redis-adapter';
// eslint-disable-next-line n/no-missing-import
import type { DefaultEventsMap } from 'socket.io/dist/typed-events.js';
import type { Probe } from '../../probe/types.js';
import { getRedisClient } from '../redis/client.js';
import { SyncedProbeList } from './synced-probe-list.js';
import { client } from '../sql/client.js';
import { ProbeOverride } from '../override/probe-override.js';
import { ProbeIpLimit } from './helper/probe-ip-limit.js';
import { AdoptedProbes } from '../override/adopted-probes.js';
import { AdminData } from '../override/admin-data.js';

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
	const redis = getRedisClient();
	const pubClient = redis.duplicate();
	const subClient = redis.duplicate();

	await Promise.all([ pubClient.connect(), subClient.connect() ]);

	io = new Server({
		transports: [ 'websocket' ],
		serveClient: false,
		pingInterval: 3000,
		pingTimeout: 3000,
	});

	io.adapter(createShardedAdapter(pubClient, subClient, {
		subscriptionMode: 'dynamic-private',
	}));

	syncedProbeList = new SyncedProbeList(redis, io.of(PROBES_NAMESPACE), probeOverride);

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

export const fetchRawProbes = async (): Promise<Probe[]> => {
	if (!syncedProbeList) {
		throw new Error('WS server not initialized yet');
	}

	return syncedProbeList.getRawProbes();
};

export const fetchProbesWithAdminData = async (): Promise<Probe[]> => {
	if (!syncedProbeList) {
		throw new Error('WS server not initialized yet');
	}

	return syncedProbeList.getProbesWithAdminData();
};

export const fetchProbes = async ({ allowStale = true } = {}): Promise<Probe[]> => {
	if (!syncedProbeList) {
		throw new Error('WS server not initialized yet');
	}

	return allowStale ? syncedProbeList.getProbes() : syncedProbeList.fetchProbes();
};

export const adoptedProbes = new AdoptedProbes(client, fetchRawProbes);

export const adminData = new AdminData(client);

export const probeOverride = new ProbeOverride(adoptedProbes, adminData);

export const probeIpLimit = new ProbeIpLimit(fetchProbes, fetchRawSockets);
