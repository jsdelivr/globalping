import process from 'node:process';
import {scopedLogger} from './lib/logger.js';
import {createServer} from './lib/server.js';

const logger = scopedLogger('global');
const port = process.env['PORT'] ?? 3000;

const workerFn = async () => {
	const server = await createServer();

	server.listen(port, () => {
		logger.info(`application started on port ${port}`);
	});
};

workerFn().catch(error => {
	logger.error('failed to start cluster', error);
});
