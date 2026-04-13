import { promisify } from 'node:util';
import { brotliDecompress as brotliDecompressCallback } from 'node:zlib';
import { transformArguments as transformJsonGetArguments } from '@redis/json/dist/commands/GET.js';
import { RedisCluster } from './shared.js';

const brotliDecompress = promisify(brotliDecompressCallback);

export type CompressedJsonGetOptions = Parameters<typeof transformJsonGetArguments>[1];

export async function decodeCompressedJsonBuffer (data: Buffer | null) {
	if (!data || !data.length) {
		return data;
	}

	if (data[0] === 0x00) {
		return data.subarray(1);
	}

	return brotliDecompress(data.subarray(1));
}

export async function parseCompressedJsonBuffer<T> (data: Buffer | null) {
	return decodeCompressedJsonBuffer(data)
		.then(decoded => decoded ? JSON.parse(decoded.toString('utf8')) as T : null);
}

export async function compressedJsonGetBuffer (this: RedisCluster, key: string, options?: CompressedJsonGetOptions) {
	const args = transformJsonGetArguments(key, options);
	args[0] = 'COMPRESSED.JSON.GET';

	return this.sendCommand<Buffer | null>(key, true, args, { returnBuffers: true })
		.then(data => decodeCompressedJsonBuffer(data));
}

export async function compressedJsonGet<T> (this: RedisCluster, key: string, options?: CompressedJsonGetOptions) {
	return compressedJsonGetBuffer.call(this, key, options)
		.then(data => data ? JSON.parse(data.toString('utf8')) as T : null);
}

export function compressedJsonCompress (this: RedisCluster, key: string) {
	return this.sendCommand<string>(key, true, [ 'COMPRESSED.JSON.COMPRESS', key ]);
}
