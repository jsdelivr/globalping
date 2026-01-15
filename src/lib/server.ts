import type { Server } from 'node:http';
import v8 from 'node:v8';
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
import { disconnectProbes, reconnectProbes } from './ws/helper/reconnect-probes.js';
import { initPersistentRedisClient } from './redis/persistent-client.js';
import { initMeasurementRedisClient } from './redis/measurement-client.js';
import { initSubscriptionRedisClient } from './redis/subscription-client.js';
import termListener from './term-listener.js';
import { auth } from './http/auth.js';
import { adoptionToken } from '../adoption/adoption-token.js';
import { scopedLogger } from './logger.js';

const logger = scopedLogger('server');

process.on('SIGUSR2', () => {
	const stats = v8.getHeapStatistics();
	const mem = process.memoryUsage();
	const res = process.resourceUsage();
	const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(2);
	logger.info(`memory data:`, {
		getHeapStatistics: Object.fromEntries(Object.entries(stats).map(([ k, v ]) => [ k, typeof v === 'number' ? mb(v) : v ])),
		memoryUsage: Object.fromEntries(Object.entries(mem).map(([ k, v ]) => [ k, typeof v === 'number' ? mb(v) : v ])),
		resourceUsage: Object.fromEntries(Object.entries(res).map(([ k, v ]) => [ k, typeof v === 'number' ? mb(v) : v ])),
	});
});

export const createServer = async (): Promise<Server> => {
	await initRedisClient();
	await initPersistentRedisClient();
	await initMeasurementRedisClient();
	await initSubscriptionRedisClient();

	// Populate in-memory lists
	await Promise.all([
		populateMemMalwareList(),
		populateMemCloudIpRangesList(),
		populateMemBlockedIpRangesList(),
		populateIpWhiteList(),
		populateCitiesList(),
		populateLegalNames(),
		populateAsnData(),
	]);

	// Populate Dashboard override data before using it during initWsServer()
	await probeOverride.fetchDashboardData();
	probeOverride.scheduleSync();

	adoptionToken.scheduleSync();

	await initWsServer();

	await auth.syncTokens();
	auth.scheduleSync();

	probeIpLimit.scheduleSync();

	reconnectProbes();
	// Disconnect probes shortly before shutdown to prevent data loss.
	termListener.on('terminating', ({ delay }) => setTimeout(() => void disconnectProbes(0), delay - 10000));

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
