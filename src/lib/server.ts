import type {Server} from 'node:http';
import {initRedis} from './redis/client.js';
import {initWsServer} from './ws/server.js';

export const createServer = async (): Promise<Server> => {
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

	return httpServer;
};
