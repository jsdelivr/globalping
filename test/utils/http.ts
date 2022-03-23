import type {Server} from 'node:http';
import {createServer} from '../../src/lib/server.js';

let app: Server;

export const getTestServer = async (): Promise<Server> => {
	if (!app) {
		app = await createServer();
		app.listen(0);
	}

	return app;
};
