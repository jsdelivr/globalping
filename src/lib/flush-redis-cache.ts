import fs from 'fs/promises';
import path from 'node:path';
import { getRedisClient } from './redis/client.js';
import { getPersistentRedisClient } from './redis/persistent-client.js';

export async function flushRedisCache () {
	if (process.env['NODE_ENV'] === 'production' && !process.env['HOSTNAME']) {
		throw new Error('HOSTNAME env variable is not specified');
	}

	const redis = getRedisClient();
	const persistentRedis = getPersistentRedisClient();
	const hostname = process.env['HOSTNAME'] || 'default';
	const filePath = path.join(path.resolve(), 'data/LAST_API_COMMIT_HASH.txt');

	const lastCommitHashInRedis = await persistentRedis.get(`LAST_API_COMMIT_HASH_${hostname}`);
	const currentLastCommitHash = (await fs.readFile(filePath, 'utf8')).trim();

	if (lastCommitHashInRedis !== currentLastCommitHash) {
		await redis.flushDb();
		await persistentRedis.set(`LAST_API_COMMIT_HASH_${hostname}`, currentLastCommitHash);
	}
}
