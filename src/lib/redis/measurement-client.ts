import type { RedisClientOptions } from 'redis';
import { createRedisClientInternal, type RedisClient } from './shared.js';

export type { RedisClient } from './shared.js';

let redis: RedisClient;

export const initMeasurementRedisClient = async () => {
	redis = createMeasurementRedisClient();
	return redis;
};

export const createMeasurementRedisClient = (options?: RedisClientOptions): RedisClient => {
	return createRedisClientInternal({
		...options,
		database: 0,
		name: 'measurement',
	});
};

export const getMeasurementRedisClient = (): RedisClient => {
	redis = createMeasurementRedisClient();
	return redis;
};
