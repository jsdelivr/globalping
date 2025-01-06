import config from 'config';
import type { RedisClientOptions } from 'redis';
import { createRedisClientInternal, type RedisClient, type RedisClientInternal } from './shared.js';

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
		...config.util.toObject(config.get('redis.shared')) as RedisClientOptions,
		...config.util.toObject(config.get('redis.standalonePersistent')) as RedisClientOptions,
		...options,
		name: 'persistent',
	});
};

export const getPersistentRedisClient = (): RedisClient => {
	if (!redis) {
		const { client, connectPromise } = createPersistentRedisClient();
		redis = client;
		redisConnectPromise = connectPromise;
	}

	return redis;
};
