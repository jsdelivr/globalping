import config from 'config';
import {
	createClient,
	type RedisClientOptions,
	type RedisClientType,
	type RedisDefaultModules,
	type RedisFunctions,
} from 'redis';
import { type RedisScripts, scripts } from './scripts.js';
import { scopedLogger } from '../logger.js';

const logger = scopedLogger('redis-client');

export type RedisClient = RedisClientType<RedisDefaultModules, RedisFunctions, RedisScripts>;

export const createRedisClientInternal = (options?: RedisClientOptions): RedisClient => {
	const client = createClient({
		...config.util.toObject(config.get('redis')) as RedisClientOptions,
		...options,
		scripts,
	});

	client
		.on('error', (error: Error) => logger.error('Redis connection error:', error))
		.on('ready', () => logger.info('Redis connection ready.'))
		.on('reconnecting', () => logger.info('Redis reconnecting.'))
		.connect().catch((error: Error) => logger.error('Redis connection error:', error));

	return client;
};
