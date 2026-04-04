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
import _ from 'lodash';
import Bluebird from 'bluebird';
import { type RedisScripts, scripts } from './scripts.js';
import { compressedJsonGetBuffer } from './compressed.js';
import { type Logger } from 'h-logger2';

type ClusterExtensions = {
	mapMasters: typeof mapMasters;
	reduceMasters: typeof reduceMasters;
	compressedJsonGetBuffer: typeof compressedJsonGetBuffer;
};

export type Resp3RedisClientOptions = RedisClientOptions<RedisDefaultModules, RedisFunctions, RedisScripts, 3>;
export type Resp3RedisClusterOptions = RedisClusterOptions<RedisDefaultModules, RedisFunctions, RedisScripts, 3>;

export type RedisClient = RedisClientType<RedisDefaultModules, RedisFunctions, RedisScripts, 3>;
export type RedisCluster = RedisClusterType<RedisDefaultModules, RedisFunctions, RedisScripts, 3> & ClusterExtensions;
export type RedisClientInternal = { connectPromise: Promise<unknown>; client: RedisClient };
export type RedisClusterInternal = { connectPromise: Promise<unknown>; client: RedisCluster };

export const createRedisClientInternal = (options: Resp3RedisClientOptions, logger: Logger): RedisClientInternal => {
	const client = createClient({
		RESP: 3,
		..._.cloneDeep(options),
		scripts,
	});

	const connectPromise = client
		.on('error', (error: Error) => logger.error('Redis connection error:', error))
		.on('ready', () => logger.info('Redis connection ready.'))
		.on('reconnecting', () => logger.info('Redis reconnecting.'))
		.connect().catch((error: Error) => logger.error('Redis connection error:', error));

	return { client, connectPromise };
};

export const createRedisClusterInternal = (options: Resp3RedisClusterOptions, logger: Logger): RedisClusterInternal => {
	const cluster = createCluster({
		RESP: 3,
		..._.cloneDeep(options),
		scripts,
	});

	const client = Object.assign(cluster, {
		mapMasters,
		reduceMasters,
		compressedJsonGetBuffer,
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
