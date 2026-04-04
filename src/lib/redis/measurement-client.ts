import config from 'config';
import type { RedisClientOptions, RedisClusterOptions } from 'redis';
import { createRedisClusterInternal, type RedisCluster, type RedisClusterInternal } from './shared.js';
import { scopedLogger } from '../logger.js';

export type { RedisCluster } from './shared.js';

let redis: RedisCluster;
let redisConnectPromise: Promise<unknown>;
let dedicatedRedis: RedisCluster;
let dedicatedRedisConnectPromise: Promise<unknown>;

const getMeasurementRedisOptions = (options?: Partial<RedisClusterOptions>): RedisClusterOptions => ({
	defaults: config.get<RedisClientOptions>('redis.sharedOptions'),
	rootNodes: Object.values(config.get<{ [index: string]: string }>('redis.clusterMeasurements.nodes')).map(url => ({ url })),
	...config.get<Partial<RedisClusterOptions>>('redis.clusterMeasurements.options'),
	...options,
});

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

export const initDedicatedMeasurementRedisClient = async () => {
	if (dedicatedRedis) {
		await dedicatedRedisConnectPromise;
		return dedicatedRedis;
	}

	const { client, connectPromise } = createDedicatedMeasurementRedisClient();

	dedicatedRedis = client;
	dedicatedRedisConnectPromise = connectPromise;

	await dedicatedRedisConnectPromise;
	return dedicatedRedis;
};

export const createMeasurementRedisClient = (options?: Partial<RedisClusterOptions>): RedisClusterInternal => {
	return createRedisClusterInternal(getMeasurementRedisOptions(options), scopedLogger('redis-measurement'));
};

export const createDedicatedMeasurementRedisClient = (options?: Partial<RedisClusterOptions>): RedisClusterInternal => {
	return createRedisClusterInternal(getMeasurementRedisOptions(options), scopedLogger('redis-measurement-compressed-json'));
};

export const getMeasurementRedisClient = (): RedisCluster => {
	if (!redis) {
		const { client, connectPromise } = createMeasurementRedisClient();
		redis = client;
		redisConnectPromise = connectPromise;
	}

	return redis;
};

export const getDedicatedMeasurementRedisClient = (): RedisCluster => {
	if (!dedicatedRedis) {
		const { client, connectPromise } = createDedicatedMeasurementRedisClient();
		dedicatedRedis = client;
		dedicatedRedisConnectPromise = connectPromise;
	}

	return dedicatedRedis;
};
