import config from 'config';
import process from 'node:process';
import cluster from 'node:cluster';
import { scopedLogger } from './lib/logger.js';
import { createServer } from './lib/server.js';
import { initRedisClient } from './lib/redis/client.js';
import { initPersistentRedisClient } from './lib/redis/persistent-client.js';
import { flushRedisCache } from './lib/flush-redis-cache.js';
import { MasterTermListener } from './lib/term-listener.js';

const logger = scopedLogger('index');
const port = process.env['PORT'] ?? config.get<number>('server.port');
const workerCount = config.get<number>('server.processes');

const workerFn = async () => {
	const { httpServer } = await createServer();

	httpServer.listen(port, () => {
		logger.info(`Application started at http://localhost:${port}`);
	});
};

if (cluster.isPrimary) {
	logger.info(`Master ${process.pid} is running with ${workerCount} workers.`);
	new MasterTermListener();
	const redis = await initRedisClient();
	const persistentRedis = await initPersistentRedisClient();
	await flushRedisCache();
	await redis.disconnect();
	await persistentRedis.disconnect();
	let syncAdoptionsPid: number | null = null;

	for (let i = 0; i < workerCount; i++) {
		if (!syncAdoptionsPid) {
			const worker = cluster.fork({ SHOULD_SYNC_ADOPTIONS: true });
			logger.info(`Syncing adoptions on worker ${worker.process.pid!}.`);
			syncAdoptionsPid = worker.process.pid!;
		} else {
			cluster.fork();
		}
	}

	cluster.on('exit', (worker, code, signal) => {
		logger.error(`Worker ${worker.process.pid!} died with code ${code} and signal ${signal}.`);

		if (process.env['TEST_DONT_RESTART_WORKERS']) {
			return;
		}

		if (worker.process.pid === syncAdoptionsPid) {
			const worker = cluster.fork({ SHOULD_SYNC_ADOPTIONS: true });
			logger.info(`Syncing adoptions on worker ${worker.process.pid!}.`);
			syncAdoptionsPid = worker.process.pid!;
		} else {
			cluster.fork();
		}
	});
} else {
	logger.info(`Worker ${process.pid} is running.`);

	workerFn().catch((error) => {
		logger.error('Failed to start cluster:', error);
		setTimeout(() => process.exit(1), 5000);
	});
}
