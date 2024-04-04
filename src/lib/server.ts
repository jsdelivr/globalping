import type { Server } from 'node:http';
import { initRedisClient } from './redis/client.js';
import { adoptedProbes, probeIpLimit, initWsServer } from './ws/server.js';
import { getMetricsAgent } from './metrics.js';
import { populateMemList as populateMemMalwareList } from './malware/client.js';
import { populateMemList as populateMemIpRangesList } from './ip-ranges.js';
import { populateMemList as populateIpWhiteList } from './geoip/whitelist.js';
import { populateCitiesList } from './geoip/city-approximation.js';
import { reconnectProbes } from './ws/helper/reconnect-probes.js';
import { initPersistentRedisClient } from './redis/persistent-client.js';
import { initMeasurementRedisClient } from './redis/measurement-client.js';
import { auth } from './http/auth.js';

export const createServer = async (): Promise<Server> => {
	await initRedisClient();
	await initPersistentRedisClient();
	await initMeasurementRedisClient();

	// Populate memory malware list
	await populateMemMalwareList();
	// Populate memory cloud regions list
	await populateMemIpRangesList();
	// Populate ip whiltelist
	await populateIpWhiteList();
	// Populate cities info
	await populateCitiesList();

	await initWsServer();

	await adoptedProbes.syncDashboardData();
	adoptedProbes.scheduleSync();

	await auth.syncTokens();
	auth.scheduleSync();

	probeIpLimit.scheduleSync();

	reconnectProbes();

	const { getWsServer } = await import('./ws/server.js');
	const { getHttpServer } = await import('./http/server.js');

	const httpServer = getHttpServer();
	const wsServer = getWsServer();

	wsServer.attach(httpServer);

	await import('./ws/gateway.js');

	const metricsAgent = getMetricsAgent();
	metricsAgent.run();

	return httpServer;
};
