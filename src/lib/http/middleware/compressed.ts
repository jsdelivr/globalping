import { promisify } from 'node:util';
import { brotliDecompress as brotliDecompressCallback, gunzip as gunzipCallback, inflate as inflateCallback } from 'node:zlib';
import type Koa from 'koa';
import type Router from '@koa/router';
import type { ExtendedMiddleware } from '../../../types.js';

const brotliDecompress = promisify(brotliDecompressCallback);
const gunzip = promisify(gunzipCallback);
const inflate = promisify(inflateCallback);

export type SupportedCompressionEncoding = 'br' | 'gzip' | 'deflate';

export type CompressedContext = {
	compressed: (value: Buffer, encoding?: SupportedCompressionEncoding) => void;
};

export type CompressedMiddleware = Router.Middleware<Koa.DefaultState, CompressedContext>;

type CompressedBody = {
	value: Buffer;
	encoding: SupportedCompressionEncoding;
};

const decompressors: Record<SupportedCompressionEncoding, (buffer: Buffer) => Promise<Buffer>> = {
	br: brotliDecompress,
	gzip: gunzip,
	deflate: inflate,
};

const decompress = (body: Buffer, encoding: SupportedCompressionEncoding) => {
	return decompressors[encoding](body);
};

const isCompressedBody = (body: unknown): body is CompressedBody => {
	return typeof body === 'object'
		&& body !== null
		&& 'value' in body
		&& 'encoding' in body
		&& Buffer.isBuffer(body.value)
		&& typeof body.encoding === 'string';
};

export const compressed = (): ExtendedMiddleware => {
	return async (ctx, next) => {
		ctx.compressed = (value, encoding = 'br') => {
			ctx.body = { value, encoding };
		};

		await next();

		if (!isCompressedBody(ctx.body) || ctx.response.get('Content-Encoding')) {
			return;
		}

		const compressedBody = ctx.body;

		ctx.vary('Accept-Encoding');

		if (ctx.acceptsEncodings(compressedBody.encoding, 'identity') === compressedBody.encoding) {
			ctx['compress'] = false;
			ctx.set('Content-Encoding', compressedBody.encoding);
			ctx.set('Content-Length', String(compressedBody.value.length));
			ctx.body = compressedBody.value;
			return;
		}

		ctx.remove('Content-Length');
		ctx.body = await decompress(compressedBody.value, compressedBody.encoding);
	};
};
