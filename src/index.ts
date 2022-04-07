/* Appsignal MUST be called before any other imports */
import './lib/appsignal.js';

import process from 'node:process';
import {scopedLogger} from './lib/logger.js';
import {createServer} from './lib/server.js';
import {updateList as updateMalwareList} from './lib/malware/client.js';

const logger = scopedLogger('global');
const port = process.env['PORT'] ?? 3000;

const workerFn = async () => {
	await updateMalwareList();
	const server = await createServer();

	server.listen(port, () => {
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
