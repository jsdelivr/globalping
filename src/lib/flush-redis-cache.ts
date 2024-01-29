import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { scopedLogger } from './logger.js';
import { getRedisClient } from './redis/client.js';
import { getPersistentRedisClient } from './redis/persistent-client.js';

const logger = scopedLogger('flush-redis-cache');

export async function flushRedisCache () {
	if (process.env['NODE_ENV'] === 'production' && !process.env['HOSTNAME']) {
		throw new Error('HOSTNAME env variable is not specified');
	}

	const redis = getRedisClient();
	const persistentRedis = getPersistentRedisClient();
	const hostname = process.env['HOSTNAME'] || process.env['NODE_ENV'];
	const filePath = path.join(path.resolve(), 'data/LAST_API_COMMIT_HASH.txt');

	const lastCommitHashInRedis = await persistentRedis.get(`LAST_API_COMMIT_HASH_${hostname}`);
	const currentLastCommitHash = (await readFile(filePath, 'utf8')).trim();

	if (lastCommitHashInRedis !== currentLastCommitHash) {
		logger.info('Latest commit hash changed. Clearing redis cache.');
		await redis.flushDb();
		await persistentRedis.set(`LAST_API_COMMIT_HASH_${hostname}`, currentLastCommitHash);
	}
}
