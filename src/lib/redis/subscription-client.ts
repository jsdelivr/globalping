import config from 'config';
import type { RedisClientOptions } from 'redis';
import { createRedisClientInternal, type RedisClientInternal } from './shared.js';
import { scopedLogger } from '../logger.js';

export type { RedisClient } from './shared.js';

export const initSubscriptionRedisClient = async () => {
	const { connectPromise, client } = createSubscriptionRedisClient();
	await connectPromise;
	return client;
};

export const createSubscriptionRedisClient = (options?: RedisClientOptions): RedisClientInternal => {
	return createRedisClientInternal({
		...config.util.toObject(config.get('redis.shared')) as RedisClientOptions,
		...config.util.toObject(config.get('redis.standaloneNonPersistent')) as RedisClientOptions,
		...options,
		name: 'subscription',
	}, scopedLogger('redis-subscription'));
};
