import config from 'config';
import type { RedisClientOptions } from 'redis';
import { createRedisClientInternal, type RedisClient, type RedisClientInternal } from './shared.js';
import { scopedLogger } from '../logger.js';

export type { RedisClient } from './shared.js';

let redis: RedisClient;
let redisConnectPromise: Promise<unknown>;

export const initPersistentRedisClient = async () => {
	if (redis) {
		await redisConnectPromise;
		return redis;
	}

	const { client, connectPromise } = createPersistentRedisClient();

	redis = client;
	redisConnectPromise = connectPromise;

	await redisConnectPromise;
	return redis;
};

export const createPersistentRedisClient = (options?: RedisClientOptions): RedisClientInternal => {
	return createRedisClientInternal({
		...config.get<RedisClientOptions>('redis.sharedOptions'),
		...config.get<RedisClientOptions>('redis.standalonePersistent'),
		...options,
		name: 'persistent',
	}, scopedLogger('redis-persistent'));
};

export const getPersistentRedisClient = (): RedisClient => {
	if (!redis) {
		const { client, connectPromise } = createPersistentRedisClient();
		redis = client;
		redisConnectPromise = connectPromise;
	}

	return redis;
};
