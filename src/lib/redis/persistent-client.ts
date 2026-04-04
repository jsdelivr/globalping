import config from 'config';
import { createRedisClientInternal, type RedisClient, type RedisClientInternal, type Resp3RedisClientOptions } from './shared.js';
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

export const createPersistentRedisClient = (options?: Partial<Resp3RedisClientOptions>): RedisClientInternal => {
	return createRedisClientInternal({
		...config.get<Partial<Resp3RedisClientOptions>>('redis.sharedOptions'),
		...config.get<Partial<Resp3RedisClientOptions>>('redis.standalonePersistent'),
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
