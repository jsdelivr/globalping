import type {Server} from 'node:http';
import _ from 'lodash';

import {createServer} from '../../src/lib/server.js';
import {
	populateIpList,
	populateDomainList,
} from './malware.js';

let app: Server;

export const getTestServer = async (): Promise<Server> => {
	// eslint-disable-next-line @typescript-eslint/ban-types
	_.throttle = ((func: Function) => func) as unknown as typeof _.throttle;
	await populateIpList();
	await populateDomainList();

	if (!app) {
		app = await createServer();
		app.listen(0);
	}

	return app;
};
