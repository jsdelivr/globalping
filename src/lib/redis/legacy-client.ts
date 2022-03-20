import config from 'config';
import {createClient, RedisClientType, RedisDefaultModules, RedisScripts} from 'redis';

export type RedisClient = RedisClientType<RedisDefaultModules, RedisScripts>;

let redis: RedisClient;

export const initRedis = async () => {
	redis = await createRedisClient();
};

export const createRedisClient = async (): Promise<RedisClient> => {
	const client = createClient({
		...config.util.toObject(config.get('redis')),
		legacyMode: true,
	});
	await client.connect();

	return client;
};

export const getRedisClient = (): RedisClient => {
	if (!redis) {
		throw new Error('redis connection is not initialize yet');
	}

	return redis;
};
