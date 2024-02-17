import type { RedisClientOptions } from 'redis';
import { createRedisClientInternal, type RedisClient } from './shared.js';

export type { RedisClient } from './shared.js';

let redis: RedisClient;

export const initRedisClient = async () => {
	redis = await createRedisClient();
	return redis;
};

const createRedisClient = async (options?: RedisClientOptions): Promise<RedisClient> => {
	return createRedisClientInternal({
		...options,
		database: 2,
		name: 'non-persistent',
	});
};

export const getRedisClient = (): RedisClient => {
	if (!redis) {
		throw new Error('redis connection is not initialized yet');
	}

	return redis;
};
