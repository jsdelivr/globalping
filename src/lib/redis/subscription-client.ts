import config from 'config';
import { createRedisClientInternal, type RedisClientInternal, type Resp3RedisClientOptions } from './shared.js';
import { scopedLogger } from '../logger.js';

export type { RedisClient } from './shared.js';

export const initSubscriptionRedisClient = async () => {
	const { connectPromise, client } = createSubscriptionRedisClient();
	await connectPromise;
	return client;
};

export const createSubscriptionRedisClient = (options?: Partial<Resp3RedisClientOptions>): RedisClientInternal => {
	return createRedisClientInternal({
		...config.get<Partial<Resp3RedisClientOptions>>('redis.sharedOptions'),
		...config.get<Partial<Resp3RedisClientOptions>>('redis.standaloneNonPersistent'),
		...options,
		name: 'subscription',
	}, scopedLogger('redis-subscription'));
};
