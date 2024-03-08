import config from 'config';
import process from 'node:process';
import cluster from 'node:cluster';
import { scopedLogger } from './lib/logger.js';
import { createServer } from './lib/server.js';
import { initRedisClient } from './lib/redis/client.js';
import { initPersistentRedisClient } from './lib/redis/persistent-client.js';
import { flushRedisCache } from './lib/flush-redis-cache.js';

const logger = scopedLogger('index');
const port = process.env['PORT'] ?? config.get<number>('server.port');
const workerCount = config.get<number>('server.processes');
console.log('process.env[\'NODE_ENV\']', process.env['NODE_ENV']);

const workerFn = async () => {
	const server = await createServer();

	server.listen(port, () => {
		logger.info(`application started at http://localhost:${port}`);
	});
};

if (cluster.isPrimary) {
	logger.info(`Master ${process.pid} is running with ${workerCount} workers`);
	const redis = await initRedisClient();
	const persistentRedis = await initPersistentRedisClient();
	await flushRedisCache();
	await redis.disconnect();
	await persistentRedis.disconnect();

	for (let i = 0; i < workerCount; i++) {
		cluster.fork();
	}

	cluster.on('exit', (worker, code, signal) => {
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		logger.error(`worker ${worker.process.pid!} died with code ${code} and signal ${signal}`);

		if (process.env['TEST_DONT_RESTART_WORKERS']) {
			return;
		}

		cluster.fork();
	});
} else {
	logger.info(`Worker ${process.pid} is running`);

	workerFn().catch((error) => {
		logger.error('failed to start cluster', error);
	});
}
