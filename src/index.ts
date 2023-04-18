import config from 'config';
import process from 'node:process';
import cluster from 'node:cluster';
import { scopedLogger } from './lib/logger.js';
import { createServer } from './lib/server.js';

const logger = scopedLogger('index');
const port = process.env['PORT'] ?? config.get<number>('server.port');
const workerCount = config.get<number>('server.processes');

const workerFn = async () => {
	const server = await createServer();

	server.listen(port, () => {
		logger.info(`application started on port ${port}`);
	});
};

if (cluster.isPrimary) {
	logger.info(`Master ${process.pid} is running with ${workerCount} workers`);

	for (let i = 0; i < workerCount; i++) {
		cluster.fork();
	}

	cluster.on('exit', (worker, code, signal) => {
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		logger.error(`worker ${worker.process.pid!} died with code ${code} and signal ${signal}`);
		cluster.fork();
	});
} else {
	logger.info(`Worker ${process.pid} is running`);

	workerFn().catch((error) => {
		logger.error('failed to start cluster', error);
	});
}
