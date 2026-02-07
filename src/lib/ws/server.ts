import { EventEmitter } from 'node:events';
import { Namespace, type RemoteSocket, Server, Socket } from 'socket.io';
import { createShardedAdapter } from '@socket.io/redis-adapter';
import config from 'config';
import type { ServerProbe, SocketProbe } from '../../probe/types.js';
import { getRedisClient } from '../redis/client.js';
import { SyncedProbeList } from './synced-probe-list.js';
import { dashboardClient } from '../sql/client.js';
import { ProbeOverride } from '../override/probe-override.js';
import { ProbeIpLimit } from './helper/probe-ip-limit.js';
import { AdoptedProbes } from '../override/adopted-probes.js';
import { AdminData } from '../override/admin-data.js';
import { initSubscriptionRedisClient } from '../redis/subscription-client.js';

export interface DefaultEventsMap {
	// TODO: maybe create type definitions for the events?
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	[event: string]: (...args: any[]) => void;
}

export type SocketData = {
	probe: SocketProbe;
};

export type RemoteProbeSocket = RemoteSocket<DefaultEventsMap, SocketData>;

export type ServerSocket = Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, SocketData>;

export type WsServer = Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, SocketData>;

export type WsServerNamespace = Namespace<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, SocketData>;

export const PROBES_NAMESPACE = '/probes';

const ee = new EventEmitter();
const E_PROBE_UPDATE = 'probe-update';

let io: WsServer;
let syncedProbeList: SyncedProbeList;

export const initWsServer = async () => {
	const redis = getRedisClient();
	const [ subClient1, subClient2 ] = await Promise.all([ initSubscriptionRedisClient(), initSubscriptionRedisClient() ]);

	io = new Server({
		transports: [ 'websocket' ],
		serveClient: false,
		pingInterval: config.get<number>('websocketServer.pingInterval'),
		pingTimeout: config.get<number>('websocketServer.pingTimeout'),
	});

	io.adapter(createShardedAdapter(redis, subClient1, {
		subscriptionMode: 'dynamic-private',
	}));

	syncedProbeList = new SyncedProbeList(redis, subClient2, io.of(PROBES_NAMESPACE), probeOverride);
	syncedProbeList.on(syncedProbeList.localUpdateEvent, () => ee.emit(E_PROBE_UPDATE));

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

export const getProbesWithAdminData = (): SocketProbe[] => {
	if (!syncedProbeList) {
		throw new Error('WS server not initialized yet');
	}

	return syncedProbeList.getProbesWithAdminData();
};

export const fetchProbes = async ({ allowStale = true } = {}): Promise<ServerProbe[]> => {
	if (!syncedProbeList) {
		throw new Error('WS server not initialized yet');
	}

	return allowStale ? syncedProbeList.getProbes() : syncedProbeList.fetchProbes();
};

export const getProbeByIp = async (ip: string, { allowStale = true } = {}): Promise<ServerProbe | null> => {
	if (!syncedProbeList) {
		throw new Error('WS server not initialized yet');
	}

	if (!allowStale) {
		await syncedProbeList.fetchProbes();
	}

	return syncedProbeList.getProbeByIp(ip);
};

export const onProbesUpdate = (callback: (probes: ServerProbe[]) => void): (() => void) => {
	const handler = () => callback(syncedProbeList.getProbes());
	ee.on(E_PROBE_UPDATE, handler);

	if (syncedProbeList) {
		callback(syncedProbeList.getProbes());
	}

	return () => ee.off(E_PROBE_UPDATE, handler);
};

export const adoptedProbes = new AdoptedProbes(dashboardClient, getProbesWithAdminData);

export const adminData = new AdminData(dashboardClient);

export const probeOverride = new ProbeOverride(adoptedProbes, adminData);

export const probeIpLimit = new ProbeIpLimit(fetchProbes, fetchRawSockets, getProbeByIp);
