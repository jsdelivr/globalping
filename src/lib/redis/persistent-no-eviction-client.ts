import config from 'config';
import type { RedisClientOptions } from 'redis';
import { createRedisClientInternal, type RedisClient, type RedisClientInternal } from './shared.js';
import { scopedLogger } from '../logger.js';

export type { RedisClient } from './shared.js';

let redis: RedisClient;
let redisConnectPromise: Promise<unknown>;

export const initPersistentNoEvictionRedisClient = async () => {
	if (redis) {
		await redisConnectPromise;
		return redis;
	}

	const { client, connectPromise } = createPersistentNoEvictionRedisClient();

	redis = client;
	redisConnectPromise = connectPromise;

	await redisConnectPromise;
	return redis;
};

export const createPersistentNoEvictionRedisClient = (options?: RedisClientOptions): RedisClientInternal => {
	return createRedisClientInternal({
		...config.get<RedisClientOptions>('redis.sharedOptions'),
		...config.get<RedisClientOptions>('redis.standalonePersistentNoEviction'),
		...options,
		disableOfflineQueue: true,
		name: 'persistent-no-eviction',
	}, scopedLogger('redis-persistent-no-eviction'));
};

export const getPersistentNoEvictionRedisClient = (): RedisClient => {
	if (!redis) {
		const { client, connectPromise } = createPersistentNoEvictionRedisClient();
		redis = client;
		redisConnectPromise = connectPromise;
	}

	return redis;
};
