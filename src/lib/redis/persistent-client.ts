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

const logger = scopedLogger('persistent-redis-client');

export type PersistentRedisClient = RedisClientType<RedisDefaultModules, RedisFunctions, RedisScripts>;

let redis: PersistentRedisClient;

export const initPersistentRedisClient = async () => {
	redis = await createPersistentRedisClient();
};

export const createPersistentRedisClient = async (options?: RedisClientOptions): Promise<PersistentRedisClient> => {
	const client = createClient({
		...config.util.toObject(config.get('redis')) as RedisClientOptions,
		...options,
		database: 1,
		name: 'persistent',
		scripts: { count, recordResult, markFinished },
	});

	client
		.on('error', (error: Error) => logger.error('connection error', error))
		.on('ready', () => logger.info('connection ready'))
		.on('reconnecting', () => logger.info('reconnecting'));

	await client.connect();

	return client;
};

export const getPersistentRedisClient = (): PersistentRedisClient => {
	if (!redis) {
		throw new Error('redis connection to persistent db is not initialized yet');
	}

	return redis;
};
