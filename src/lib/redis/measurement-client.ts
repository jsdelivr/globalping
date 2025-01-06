import config from 'config';
import type { RedisClientOptions, RedisClusterOptions } from 'redis';
import { createRedisClusterInternal, type RedisCluster, type RedisClusterInternal } from './shared.js';

export type { RedisCluster } from './shared.js';

let redis: RedisCluster;
let redisConnectPromise: Promise<unknown>;

export const initMeasurementRedisClient = async () => {
	if (redis) {
		await redisConnectPromise;
		return redis;
	}

	const { client, connectPromise } = createMeasurementRedisClient();

	redis = client;
	redisConnectPromise = connectPromise;

	await redisConnectPromise;
	return redis;
};

export const createMeasurementRedisClient = (options?: RedisClusterOptions): RedisClusterInternal => {
	return createRedisClusterInternal({
		defaults: { ...config.util.toObject(config.get('redis.shared')) as RedisClientOptions },
		...config.util.toObject(config.get('redis.clusterMeasurements')) as RedisClusterOptions,
		...options,
	});
};

export const getMeasurementRedisClient = (): RedisCluster => {
	if (!redis) {
		const { client, connectPromise } = createMeasurementRedisClient();
		redis = client;
		redisConnectPromise = connectPromise;
	}

	return redis;
};
