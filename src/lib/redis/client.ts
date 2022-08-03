import config from 'config';
import Redis from 'ioredis';

export type RedisClient = Redis;

let redis: RedisClient;

export const initRedis = async () => {
	redis = await createRedisClient();
};

export const createRedisClient = async (options?: Record<string, any>): Promise<RedisClient> => {
	const client = new Redis({
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
