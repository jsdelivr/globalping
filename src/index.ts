/* Appsignal MUST be called before any other imports */
import './lib/appsignal.js';

import process from 'node:process';
import {initRedis} from './lib/redis/client.js';
import {initRedis as initLegacyRedis} from './lib/redis/legacy-client.js';
import {initWsServer} from './lib/ws/server.js';
import {scopedLogger} from './lib/logger.js';

const logger = scopedLogger('global');
const port = process.env['PORT'] ?? 3000;

const workerFn = async () => {
	await initRedis();
	await initLegacyRedis();
	await initWsServer();

	// eslint-disable-next-line node/no-unsupported-features/es-syntax
	const {getWsServer} = await import('./lib/ws/server.js');
	// eslint-disable-next-line node/no-unsupported-features/es-syntax
	const {getHttpServer} = await import('./lib/http/server.js');

	const httpServer = getHttpServer();
	const wsServer = getWsServer();

	wsServer.attach(httpServer);

	// Init gateway
	// eslint-disable-next-line node/no-unsupported-features/es-syntax
	await import('./lib/ws/gateway.js');

	httpServer.listen(port, () => {
		logger.info(`application started on port ${port}`);
	});
};

workerFn().catch(error => {
	logger.error('failed to start cluster', error);
});

// Throng({
//   // master: async () => {
//   //   await ensureProbeSearchIndex();
//   // },
//   worker: workerFn,
// }).catch(error => {
//   logger.error('failed to start cluster', error);
//   process.exit(1);
// });
