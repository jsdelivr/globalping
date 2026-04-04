import config from 'config';
import { createRedisClientInternal, type RedisClient, type RedisClientInternal, type Resp3RedisClientOptions } from './shared.js';
import { scopedLogger } from '../logger.js';

export type { RedisClient } from './shared.js';

let redis: RedisClient;
let redisConnectPromise: Promise<unknown>;

export const initRedisClient = async () => {
	if (redis) {
		await redisConnectPromise;
		return redis;
	}

	const { client, connectPromise } = createRedisClient();

	redis = client;
	redisConnectPromise = connectPromise;

	await redisConnectPromise;
	return redis;
};

const createRedisClient = (options?: Partial<Resp3RedisClientOptions>): RedisClientInternal => {
	return createRedisClientInternal({
		...config.get<Partial<Resp3RedisClientOptions>>('redis.sharedOptions'),
		...config.get<Partial<Resp3RedisClientOptions>>('redis.standaloneNonPersistent'),
		...options,
		name: 'non-persistent',
	}, scopedLogger('redis-non-persistent'));
};

export const getRedisClient = (): RedisClient => {
	if (!redis) {
		const { client, connectPromise } = createRedisClient();
		redis = client;
		redisConnectPromise = connectPromise;
	}

	return redis;
};
