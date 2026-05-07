import { promisify } from 'node:util';
import { brotliCompress as brotliCompressCallback, brotliDecompress as brotliDecompressCallback, constants as zlibConstants } from 'node:zlib';
import { RESP_TYPES, type RedisArgument } from 'redis';
import { RedisCluster } from './shared.js';

const brotliCompress = promisify(brotliCompressCallback);
const brotliDecompress = promisify(brotliDecompressCallback);

export type CompressedJsonGetOptions = {
	path?: RedisArgument | RedisArgument[];
};

export async function decodeCompressedJsonBuffer (data: Buffer | null) {
	if (!data || !data.length) {
		return data;
	}

	if (data[0] === 0x00) {
		return data.subarray(1);
	}

	return brotliDecompress(data.subarray(1));
}

export async function normalizeCompressedJsonBuffer (data: Buffer | null) {
	if (!data || !data.length) {
		return data;
	}

	if (data[0] === 0x01) {
		return data.subarray(1);
	}

	return brotliCompress(data.subarray(1), { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 4 } });
}

export async function parseCompressedJsonBuffer<T> (data: Buffer | null) {
	return decodeCompressedJsonBuffer(data)
		.then(decoded => decoded ? JSON.parse(decoded.toString('utf8')) as T : null);
}

export async function compressedJsonGetBuffer (this: RedisCluster, key: string, options?: CompressedJsonGetOptions) {
	return compressedJsonGetRawBuffer.call(this, key, options)
		.then(data => decodeCompressedJsonBuffer(data));
}

export async function compressedJsonGetBufferCompressed (this: RedisCluster, key: string, options?: CompressedJsonGetOptions) {
	return compressedJsonGetRawBuffer.call(this, key, options)
		.then(data => normalizeCompressedJsonBuffer(data));
}

async function compressedJsonGetRawBuffer (this: RedisCluster, key: string, options?: CompressedJsonGetOptions) {
	const args: RedisArgument[] = [ 'COMPRESSED.JSON.GET', key ];

	if (options?.path !== undefined) {
		args.push(...(Array.isArray(options.path) ? options.path : [ options.path ]));
	}

	return this.sendCommand<Buffer | null>(key, true, args, { typeMapping: { [RESP_TYPES.BLOB_STRING]: Buffer } });
}

export async function compressedJsonGet<T> (this: RedisCluster, key: string, options?: CompressedJsonGetOptions) {
	return compressedJsonGetBuffer.call(this, key, options)
		.then(data => data ? JSON.parse(data.toString('utf8')) as T : null);
}

export function compressedJsonCompress (this: RedisCluster, key: string) {
	return this.sendCommand<string>(key, false, [ 'COMPRESSED.JSON.COMPRESS', key ]);
}
