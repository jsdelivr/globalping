import type { RedisClientOptions } from 'redis';
import { createRedisClientInternal, type RedisClient } from './shared.js';

export type { RedisClient } from './shared.js';

let redis: RedisClient;

export const initSubscriptionRedisClient = async () => {
	redis = createSubscriptionRedisClient();
	return redis;
};

export const createSubscriptionRedisClient = (options?: RedisClientOptions): RedisClient => {
	return createRedisClientInternal({
		...options,
		name: 'subscription',
	});
};

export const getSubscriptionRedisClient = (): RedisClient => {
	if (!redis) {
		redis = createSubscriptionRedisClient();
	}

	return redis;
};
