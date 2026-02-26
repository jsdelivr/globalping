import { initRedisClient } from './redis/client.js';
import { initWsServer, type WsServer } from './ws/server.js';
import { initMetricsAgent, type MetricsAgent } from './metrics.js';
import { populateMemList as populateMemMalwareList } from './malware/client.js';
import { populateMemList as populateMemCloudIpRangesList } from './cloud-ip-ranges.js';
import { populateMemList as populateMemBlockedIpRangesList } from './blocked-ip-ranges.js';
import { populateMemList as populateIpWhiteList } from './geoip/whitelist.js';
import { populateCitiesList } from './geoip/city-approximation.js';
import { populateLegalNames } from './geoip/legal-name-normalization.js';
import { populateAsnData } from './geoip/asns.js';
import { disconnectProbes, reconnectProbes } from './ws/helper/reconnect-probes.js';
import { initPersistentRedisClient } from './redis/persistent-client.js';
import { initMeasurementRedisClient } from './redis/measurement-client.js';
import { initSubscriptionRedisClient } from './redis/subscription-client.js';
import termListener from './term-listener.js';
import { auth } from './http/auth.js';
import { initAdoptionToken, type AdoptionToken } from '../adoption/adoption-token.js';
import { logIfTooLong } from './log-if-too-long.js';
import { ProbeIpLimit } from './ws/helper/probe-ip-limit.js';
import { AdoptedProbes } from './override/adopted-probes.js';
import { AdminData } from './override/admin-data.js';
import { ProbeOverride } from './override/probe-override.js';
import { dashboardClient } from './sql/client.js';
import { initMeasurementRunner, type MeasurementRunner } from '../measurement/runner.js';
import { initCodeSender, type CodeSender } from '../adoption/sender.js';
import { initProbeRouter, type ProbeRouter } from '../probe/router.js';
import { initProbesLocationFilter } from '../probe/probes-location-filter.js';
import type { SyncedProbeList } from './ws/synced-probe-list.js';
import type { SocketProbe } from '../probe/types.js';
import { initAltIpsClient, type AltIpsClient } from './alt-ips-client.js';

type WsServerExports = Awaited<ReturnType<typeof initWsServer>>;

export type IoContext = {
	io: WsServer;
	syncedProbeList: SyncedProbeList;
	adoptedProbes: AdoptedProbes;
	adminData: AdminData;
	probeOverride: ProbeOverride;
	probeIpLimit: ProbeIpLimit;
	metricsAgent: MetricsAgent;
	measurementRunner: MeasurementRunner;
	codeSender: CodeSender;
	probeRouter: ProbeRouter;
	adoptionToken: AdoptionToken;
	altIpsClient: AltIpsClient;
	fetchProbes: WsServerExports['fetchProbes'];
	getProbeByIp: WsServerExports['getProbeByIp'];
	fetchRawSockets: WsServerExports['fetchRawSockets'];
	disconnectBySocketId: WsServerExports['disconnectBySocketId'];
	onProbesUpdate: WsServerExports['onProbesUpdate'];
};

export const createServer = async () => {
	await initRedisClient();
	await initPersistentRedisClient();
	await initMeasurementRedisClient();
	await initSubscriptionRedisClient();

	// Populate in-memory lists
	await Promise.all([
		logIfTooLong(populateMemMalwareList(), 'populateMemMalwareList'),
		logIfTooLong(populateMemCloudIpRangesList(), 'populateMemCloudIpRangesList'),
		logIfTooLong(populateMemBlockedIpRangesList(), 'populateMemBlockedIpRangesList'),
		logIfTooLong(populateIpWhiteList(), 'populateIpWhiteList'),
		logIfTooLong(populateCitiesList(), 'populateCitiesList'),
		logIfTooLong(populateLegalNames(), 'populateLegalNames'),
		logIfTooLong(populateAsnData(), 'populateAsnData'),
	]);

	const getProbesWithAdminData = (): SocketProbe[] => syncedProbeList.getProbesWithAdminData();
	const adoptedProbes = new AdoptedProbes(dashboardClient, getProbesWithAdminData);
	const adminData = new AdminData(dashboardClient);
	const probeOverride = new ProbeOverride(adoptedProbes, adminData);

	// Populate Dashboard override data before using it during initWsServer()
	await logIfTooLong(probeOverride.fetchDashboardData(), 'probeOverride.fetchDashboardData');
	probeOverride.scheduleSync();

	const { io, syncedProbeList, fetchRawSockets, disconnectBySocketId, fetchProbes, getProbeByIp, onProbesUpdate } = await logIfTooLong(initWsServer(probeOverride), 'initWsServer');

	const probeIpLimit = new ProbeIpLimit(fetchProbes, disconnectBySocketId, getProbeByIp);
	const adoptionToken = initAdoptionToken(adoptedProbes);
	const metricsAgent = initMetricsAgent(io, fetchProbes);
	const altIpsClient = initAltIpsClient(probeOverride, getProbeByIp, disconnectBySocketId);
	const probesLocationFilter = initProbesLocationFilter(onProbesUpdate);
	const probeRouter = initProbeRouter(onProbesUpdate, probesLocationFilter);
	const measurementRunner = initMeasurementRunner(io, probeRouter, metricsAgent);
	const codeSender = initCodeSender(io, getProbeByIp);

	adoptionToken.scheduleSync();
	await logIfTooLong(auth.syncTokens(), 'auth.syncTokens');
	auth.scheduleSync();

	probeIpLimit.scheduleSync();

	reconnectProbes(fetchRawSockets);
	// Disconnect probes shortly before shutdown to prevent data loss.
	termListener.on('terminating', ({ delay }) => setTimeout(() => void disconnectProbes(fetchRawSockets, 0), delay - 10000));

	const ioContext: IoContext = {
		io,
		syncedProbeList,
		adoptedProbes,
		adminData,
		probeOverride,
		probeIpLimit,
		metricsAgent,
		measurementRunner,
		codeSender,
		probeRouter,
		adoptionToken,
		altIpsClient,
		fetchProbes,
		getProbeByIp,
		fetchRawSockets,
		disconnectBySocketId,
		onProbesUpdate,
	};

	const { getHttpServer } = await import('./http/server.js');
	const httpServer = getHttpServer(ioContext);
	io.attach(httpServer);

	const { initGateway } = await import('./ws/gateway.js');
	initGateway(ioContext);

	metricsAgent.run();

	return { httpServer, ioContext };
};
