import { promisify } from 'node:util';
import { brotliDecompress as brotliDecompressCallback } from 'node:zlib';
import { transformArguments as transformJsonGetArguments } from '@redis/json/dist/commands/GET.js';
import { RedisCluster } from './shared.js';

const brotliDecompress = promisify(brotliDecompressCallback);

export type CompressedJsonGetOptions = Parameters<typeof transformJsonGetArguments>[1];

export async function compressedJsonGetBuffer (this: RedisCluster, key: string, options?: CompressedJsonGetOptions) {
	const args = transformJsonGetArguments(key, options);
	args[0] = 'COMPRESSED.JSON.GET';

	return this.sendCommand<Buffer | null>(key, true, args, { returnBuffers: true }).then((data) => {
		if (!data || !data.length) {
			return data;
		}

		if (data[0] === 0x00) {
			return data.subarray(1);
		}

		return brotliDecompress(data.subarray(1));
	});
}
