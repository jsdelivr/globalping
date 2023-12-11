import config from 'config';
import {
	createClient,
	type RedisClientType,
	type RedisDefaultModules,
	type RedisClientOptions,
	type RedisFunctions,
} from 'redis';
import { scopedLogger } from '../logger.js';
import { count, recordResult, markFinished, type RedisScripts } from './scripts.js';

const logger = scopedLogger('redis-client');

export type RedisClient = RedisClientType<RedisDefaultModules, RedisFunctions, RedisScripts>;

let redis: RedisClient;

export const initRedis = async () => {
	redis = await createRedisClient();
};

export const createRedisClient = async (options?: RedisClientOptions): Promise<RedisClient> => {
	const client = createClient({
		...config.util.toObject(config.get('redis')) as RedisClientOptions,
		...options,
		scripts: { count, recordResult, markFinished },
	});

	client
		.on('error', (error: Error) => logger.error('connection error', error))
		.on('ready', () => logger.info('connection ready'))
		.on('reconnecting', () => logger.info('reconnecting'));

	await client.connect();

	return client;
};

export const getRedisClient = (): RedisClient => {
	if (!redis) {
		throw new Error('redis connection is not initialize yet');
	}

	return redis;
};
