import config from 'config';
import GPRedis from './gp-redis.js';

export type RedisClient = GPRedis;

let redis: RedisClient;

export const initRedis = async () => {
	redis = await createRedisClient();
};

export const createRedisClient = async (options?: Record<string, any>): Promise<RedisClient> => {
	const client = new GPRedis({
		...config.util.toObject(config.get('redis')),
		...options,
	});

	return client;
};

export const getRedisClient = (): RedisClient => {
	if (!redis) {
		throw new Error('redis connection is not initialize yet');
	}

	return redis;
};
