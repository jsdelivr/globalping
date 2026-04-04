import { promisify } from 'node:util';
import { brotliDecompress as brotliDecompressCallback } from 'node:zlib';
import { RESP_TYPES, type RedisArgument } from 'redis';
import type { JsonGetOptions } from '@redis/json/dist/lib/commands/GET.js';
import { RedisCluster } from './shared.js';

const brotliDecompress = promisify(brotliDecompressCallback);

export type CompressedJsonGetOptions = JsonGetOptions;
type RedisCommandArguments = Array<RedisArgument> & { preserve?: unknown };

export async function compressedJsonGetBuffer (this: RedisCluster, key: string, options?: CompressedJsonGetOptions) {
	const args: RedisCommandArguments = [ 'COMPRESSED.JSON.GET', key ];

	if (options?.path !== undefined) {
		const paths = Array.isArray(options.path) ? options.path : [ options.path ];
		args.push(...paths as RedisArgument[]);
	}

	return this.sendCommand<Buffer | null>(key, true, args, {
		typeMapping: { [RESP_TYPES.BLOB_STRING]: Buffer },
	}).then((data) => {
		if (!data || !data.length) {
			return data;
		}

		if (data[0] === 0x00) {
			return data.subarray(1);
		}

		return brotliDecompress(data.subarray(1));
	});
}
