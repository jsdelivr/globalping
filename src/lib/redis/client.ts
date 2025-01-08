import config from 'config';
import type { RedisClientOptions } from 'redis';
import { createRedisClientInternal, type RedisClient, type RedisClientInternal } from './shared.js';
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

const createRedisClient = (options?: RedisClientOptions): RedisClientInternal => {
	return createRedisClientInternal({
		...config.get<RedisClientOptions>('redis.sharedOptions'),
		...config.get<RedisClientOptions>('redis.standaloneNonPersistent'),
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
