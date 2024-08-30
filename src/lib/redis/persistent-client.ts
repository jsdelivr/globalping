import type { RedisClientOptions } from 'redis';
import { createRedisClientInternal, type RedisClient } from './shared.js';

export type { RedisClient } from './shared.js';

let redis: RedisClient;

export const initPersistentRedisClient = async () => {
	redis = createPersistentRedisClient();
	return redis;
};

export const createPersistentRedisClient = (options?: RedisClientOptions): RedisClient => {
	return createRedisClientInternal({
		...options,
		database: 1,
		name: 'persistent',
	});
};

export const getPersistentRedisClient = (): RedisClient => {
	if (!redis) {
		redis = createPersistentRedisClient();
	}

	return redis;
};
