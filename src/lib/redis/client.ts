import type { RedisClientOptions } from 'redis';
import { createRedisClientInternal, type RedisClient } from './shared.js';

export type { RedisClient } from './shared.js';

let redis: RedisClient;

export const initRedisClient = async () => {
	redis = createRedisClient();
	return redis;
};

const createRedisClient = (options?: RedisClientOptions): RedisClient => {
	return createRedisClientInternal({
		...options,
		database: 2,
		name: 'non-persistent',
	});
};

export const getRedisClient = (): RedisClient => {
	if (!redis) {
		redis = createRedisClient();
	}

	return redis;
};
