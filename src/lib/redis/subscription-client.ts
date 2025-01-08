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
		...config.get<RedisClientOptions>('redis.sharedOptions'),
		...config.get<RedisClientOptions>('redis.standaloneNonPersistent'),
		...options,
		name: 'subscription',
	}, scopedLogger('redis-subscription'));
};
