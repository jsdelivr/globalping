import {
	createClient,
	createCluster,
	type RedisClientOptions,
	type RedisClientType,
	type RedisClusterOptions,
	type RedisClusterType,
	type RedisDefaultModules,
	type RedisFunctions,
} from 'redis';
import Bluebird from 'bluebird';
import { type RedisScripts, scripts } from './scripts.js';
import { type Logger } from 'h-logger2';

type ClusterExtensions = {
	mapMasters: typeof mapMasters,
	reduceMasters: typeof reduceMasters,
};

export type RedisClient = RedisClientType<RedisDefaultModules, RedisFunctions, RedisScripts>;
export type RedisCluster = RedisClusterType<RedisDefaultModules, RedisFunctions, RedisScripts> & ClusterExtensions;
export type RedisClientInternal = { connectPromise: Promise<unknown>, client: RedisClient };
export type RedisClusterInternal = { connectPromise: Promise<unknown>, client: RedisCluster };

export const createRedisClientInternal = (options: RedisClientOptions, logger: Logger): RedisClientInternal => {
	const client = createClient({
		...options,
		scripts,
	});

	const connectPromise = client
		.on('error', (error: Error) => logger.error('Redis connection error:', error))
		.on('ready', () => logger.info('Redis connection ready.'))
		.on('reconnecting', () => logger.info('Redis reconnecting.'))
		.connect().catch((error: Error) => logger.error('Redis connection error:', error));

	return { client, connectPromise };
};

export const createRedisClusterInternal = (options: RedisClusterOptions, logger: Logger): RedisClusterInternal => {
	const cluster = createCluster({
		...options,
		scripts,
	});

	const client = Object.assign(cluster, {
		mapMasters,
		reduceMasters,
	});

	const connectPromise = client
		.on('error', (error: Error) => logger.error('Redis connection error:', error))
		.on('ready', () => logger.info('Redis connection ready.'))
		.on('reconnecting', () => logger.info('Redis reconnecting.'))
		.connect();

	return { client, connectPromise };
};

function mapMasters<Result> (this: RedisCluster, mapper: (client: RedisClient) => Promise<Result>) {
	return Bluebird.map(this.masters, (node) => {
		return this.nodeClient(node);
	}).map(mapper);
}

function reduceMasters<Result> (this: RedisCluster, reducer: (accumulator: Result, client: RedisClient) => Promise<Result>, initialValue: Result) {
	return Bluebird.map(this.masters, (node) => {
		return this.nodeClient(node);
	}).reduce(reducer, initialValue);
}
