import type {Server} from 'node:http';
import {createServer} from '../../src/lib/server.js';
import {
	populateIpList,
	populateDomainList,
} from './malware.js';

let app: Server;

export const getTestServer = async (): Promise<Server> => {
	await populateIpList();
	await populateDomainList();

	if (!app) {
		app = await createServer();
		app.listen(0);
	}

	return app;
};
