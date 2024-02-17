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

export const createRedisClientInternal = async (options?: RedisClientOptions): Promise<RedisClient> => {
	const client = createClient({
		...config.util.toObject(config.get('redis')) as RedisClientOptions,
		...options,
		scripts,
	});

	client
		.on('error', (error: Error) => logger.error('connection error', error))
		.on('ready', () => logger.info('connection ready'))
		.on('reconnecting', () => logger.info('reconnecting'));

	await client.connect();

	return client;
};
