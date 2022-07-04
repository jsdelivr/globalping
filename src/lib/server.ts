import type {Server} from 'node:http';
import {initRedis} from './redis/client.js';
import {initWsServer} from './ws/server.js';
import {getMetricsAgent} from './metrics.js';
import {populateMemList as populateMemMalwareList} from './malware/client.js';

export const createServer = async (): Promise<Server> => {
	// PopulateMem malware list before opening HTTP server
	await populateMemMalwareList();

	await initRedis();
	await initWsServer();

	// eslint-disable-next-line node/no-unsupported-features/es-syntax
	const {getWsServer} = await import('./ws/server.js');
	// eslint-disable-next-line node/no-unsupported-features/es-syntax
	const {getHttpServer} = await import('./http/server.js');

	const httpServer = getHttpServer();
	const wsServer = getWsServer();

	wsServer.attach(httpServer);

	// eslint-disable-next-line node/no-unsupported-features/es-syntax
	await import('./ws/gateway.js');

	const metricsAgent = getMetricsAgent();
	metricsAgent.run();

	return httpServer;
};
