import type {Server} from 'node:http';
import {initRedis} from '../../src/lib/redis/client.js';
import {initWsServer} from '../../src/lib/ws/server.js';

let app: Server;

export const initServer = async (): Promise<Server> => {
	await initRedis();
	await initWsServer();

	// eslint-disable-next-line node/no-unsupported-features/es-syntax
	const {getHttpServer} = await import('../../src/lib/http/server.js');
	const app = getHttpServer();

	return app;
};

export const getServer = () => app;
export const getOrInitServer = async () => {
	if (!app) {
		return initServer();
	}

	return app;
};
