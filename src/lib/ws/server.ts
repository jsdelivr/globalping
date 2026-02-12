import { Namespace, type RemoteSocket, Server, Socket } from 'socket.io';
import { createShardedAdapter } from '@socket.io/redis-adapter';
import config from 'config';
import type { ServerProbe, SocketProbe } from '../../probe/types.js';
import { getRedisClient } from '../redis/client.js';
import { SyncedProbeList } from './synced-probe-list.js';
import type { ProbeOverride } from '../override/probe-override.js';
import { initSubscriptionRedisClient } from '../redis/subscription-client.js';
import { populateMemList as populateMemMalwareList } from '../malware/client.js';
import { populateMemList as populateMemCloudIpRangesList } from '../cloud-ip-ranges.js';
import { EventEmitter } from 'node:events';

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

export const initWsServer = async (probeOverride: ProbeOverride) => {
	const redis = getRedisClient();
	const [ subClient1, subClient2 ] = await Promise.all([ initSubscriptionRedisClient(), initSubscriptionRedisClient() ]);

	const io: WsServer = new Server({
		transports: [ 'websocket' ],
		serveClient: false,
		pingInterval: config.get<number>('websocketServer.pingInterval'),
		pingTimeout: config.get<number>('websocketServer.pingTimeout'),
	});

	io.adapter(createShardedAdapter(redis, subClient1, {
		subscriptionMode: 'dynamic-private',
	}));

	const syncedProbeList = new SyncedProbeList(redis, subClient2, io.of(PROBES_NAMESPACE), probeOverride);

	await syncedProbeList.sync();
	syncedProbeList.scheduleSync();

	const fetchRawSockets = async () => io.of(PROBES_NAMESPACE).fetchSockets();

	const fetchProbes = async ({ allowStale = true } = {}): Promise<ServerProbe[]> => (allowStale ? syncedProbeList.getProbes() : syncedProbeList.fetchProbes());

	const getProbeByIp = async (ip: string, { allowStale = true } = {}): Promise<ServerProbe | null> => {
		if (!allowStale) {
			await syncedProbeList.fetchProbes();
		}

		return syncedProbeList.getProbeByIp(ip);
	};

	const ee = new EventEmitter();
	const E_PROBE_UPDATE = 'probe-update';

	const onProbesUpdate = (callback: (probes: ServerProbe[]) => void): (() => void) => {
		const handler = () => callback(syncedProbeList.getProbes());
		ee.on(E_PROBE_UPDATE, handler);

		if (syncedProbeList) {
			callback(syncedProbeList.getProbes());
		}

		return () => ee.off(E_PROBE_UPDATE, handler);
	};

	syncedProbeList.on(syncedProbeList.localUpdateEvent, () => ee.emit(E_PROBE_UPDATE));

	return {
		io,
		syncedProbeList,
		fetchRawSockets,
		fetchProbes,
		getProbeByIp,
		onProbesUpdate,
		populateMemMalwareList,
		populateMemCloudIpRangesList,
	};
};
