import type {Server} from 'node:http';
import {initRedis} from '../../src/lib/redis/client.js';
import {initRedis as initLegacyRedis} from '../../src/lib/redis/legacy-client.js';
import {initWsServer} from '../../src/lib/ws/server.js';

let app: Server;

export const initServer = async (): Promise<Server> => {
	// Io requires it
	await initRedis();
	// Rate limiter requires it
	await initLegacyRedis();
	await initWsServer();

	// eslint-disable-next-line node/no-unsupported-features/es-syntax
	const {getHttpServer} = await import('../../src/lib/http/server.js');
	const app = getHttpServer();

	return app;
};

export const getTestServer = () => app;
export const getOrInitTestServer = async () => {
	if (!app) {
		return initServer();
	}

	return app;
};
