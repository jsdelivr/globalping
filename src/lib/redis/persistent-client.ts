import type { RedisClientOptions } from 'redis';
import { createRedisClientInternal, type RedisClient } from './shared.js';

export type { RedisClient } from './shared.js';

let redis: RedisClient;

export const initPersistentRedisClient = async () => {
	redis = await createPersistentRedisClient();
	return redis;
};

export const createPersistentRedisClient = async (options?: RedisClientOptions): Promise<RedisClient> => {
	return createRedisClientInternal({
		...options,
		database: 1,
		name: 'persistent',
	});
};

export const getPersistentRedisClient = (): RedisClient => {
	if (!redis) {
		throw new Error('redis connection to persistent db is not initialized yet');
	}

	return redis;
};
