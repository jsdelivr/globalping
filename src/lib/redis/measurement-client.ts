import type { RedisClientOptions } from 'redis';
import { createRedisClientInternal, type RedisClient } from './shared.js';

export type { RedisClient } from './shared.js';

let redis: RedisClient;

export const initMeasurementRedisClient = async () => {
	redis = await createMeasurementRedisClient();
	return redis;
};

export const createMeasurementRedisClient = async (options?: RedisClientOptions): Promise<RedisClient> => {
	return createRedisClientInternal({
		...options,
		database: 0,
		name: 'measurement',
	});
};

export const getMeasurementRedisClient = (): RedisClient => {
	if (!redis) {
		throw new Error('redis connection to measurement db is not initialized yet');
	}

	return redis;
};
