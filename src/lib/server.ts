import type { Server } from 'node:http';
import { initRedisClient } from './redis/client.js';
import { probeOverride, probeIpLimit, initWsServer } from './ws/server.js';
import { getMetricsAgent } from './metrics.js';
import { populateMemList as populateMemMalwareList } from './malware/client.js';
import { populateMemList as populateMemCloudIpRangesList } from './cloud-ip-ranges.js';
import { populateMemList as populateMemBlockedIpRangesList } from './blocked-ip-ranges.js';
import { populateMemList as populateIpWhiteList } from './geoip/whitelist.js';
import { populateCitiesList } from './geoip/city-approximation.js';
import { populateLegalNames } from './geoip/legal-name-normalization.js';
import { populateAsnData } from './geoip/asns.js';
import { reconnectProbes } from './ws/helper/reconnect-probes.js';
import { initPersistentRedisClient } from './redis/persistent-client.js';
import { initMeasurementRedisClient } from './redis/measurement-client.js';
import { initSubscriptionRedisClient } from './redis/subscription-client.js';
import { auth } from './http/auth.js';
import { adoptionToken } from '../adoption/adoption-token.js';

export const createServer = async (): Promise<Server> => {
	await initRedisClient();
	await initPersistentRedisClient();
	await initMeasurementRedisClient();
	await initSubscriptionRedisClient();

	console.time('populateMemMalwareList');
	// Populate memory malware list
	await populateMemMalwareList();
	console.timeEnd('populateMemMalwareList');
	// Populate memory cloud regions list
	console.time('populateMemCloudIpRangesList');
	await populateMemCloudIpRangesList();
	console.timeEnd('populateMemCloudIpRangesList');
	// Populate memory blocked ip ranges list
	console.time('populateMemBlockedIpRangesList');
	await populateMemBlockedIpRangesList();
	console.timeEnd('populateMemBlockedIpRangesList');
	// Populate ip whitelist
	console.time('populateIpWhiteList');
	await populateIpWhiteList();
	console.timeEnd('populateIpWhiteList');
	// Populate cities info
	console.time('populateCitiesList');
	await populateCitiesList();
	console.timeEnd('populateCitiesList');
	// Populate legal name normalization data.
	console.time('populateLegalNames');
	await populateLegalNames();
	console.timeEnd('populateLegalNames');
	// Populate ASN normalization data.
	console.time('populateAsnData');
	await populateAsnData();
	console.timeEnd('populateAsnData');
	// Populate Dashboard override data before using it during initWsServer()
	await probeOverride.fetchDashboardData();
	probeOverride.scheduleSync();

	adoptionToken.scheduleSync();

	await initWsServer();

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
