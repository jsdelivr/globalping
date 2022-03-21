import type {Server} from 'node:http';
import {initRedis} from '../../src/lib/redis/client.js';
import {initWsServer} from '../../src/lib/ws/server.js';

let app: Server;

export const initServer = async (): Promise<Server> => {
	// Io requires it
	await initRedis();
	await initWsServer();

	// eslint-disable-next-line node/no-unsupported-features/es-syntax
	const {getHttpServer} = await import('../../src/lib/http/server.js');
	const app = getHttpServer();

	return app;
};

export const getTestServer = (): Server => app;
export const getOrInitTestServer = async (): Promise<Server> => {
	if (!app) {
		return initServer();
	}

	return app;
};
