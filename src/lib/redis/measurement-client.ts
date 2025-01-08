import config from 'config';
import type { RedisClientOptions, RedisClusterOptions } from 'redis';
import { createRedisClusterInternal, type RedisCluster, type RedisClusterInternal } from './shared.js';
import { scopedLogger } from '../logger.js';

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

export const createMeasurementRedisClient = (options?: Partial<RedisClusterOptions>): RedisClusterInternal => {
	return createRedisClusterInternal({
		defaults: config.get<RedisClientOptions>('redis.sharedOptions'),
		rootNodes: Object.values(config.get<{ [index: string]: string }>('redis.clusterMeasurements.nodes')).map(url => ({ url })),
		...config.get<Partial<RedisClusterOptions>>('redis.clusterMeasurements.options'),
		...options,
	}, scopedLogger('redis-measurement'));
};

export const getMeasurementRedisClient = (): RedisCluster => {
	if (!redis) {
		const { client, connectPromise } = createMeasurementRedisClient();
		redis = client;
		redisConnectPromise = connectPromise;
	}

	return redis;
};
