import { stat } from 'node:fs/promises';
import { Stats } from 'node:fs';
import { Stream } from 'node:stream';
import { xxh3 } from '@node-rs/xxhash';
import type { Context, Middleware } from 'koa';

const isStats = (value: unknown): value is Stats => value instanceof Stats;

const entityTag = (entity: string | Buffer) => {
	const hash = xxh3.xxh128(entity);
	const hashHex = hash.toString(32).padStart(26, '0');
	const length = typeof entity === 'string'
		? Buffer.byteLength(entity, 'utf8')
		: entity.length;

	return `"${length.toString(16)}-${hashHex}"`;
};

const statTag = (stats: Stats) => {
	const mtime = stats.mtime.getTime().toString(16);
	const size = stats.size.toString(16);
	return `"${size}-${mtime}"`;
};

const getResponseEntity = async (ctx: Context) => {
	const body = ctx.body;

	if (!body || ctx.response.get('etag')) {
		return;
	}

	if (ctx.status < 200 || ctx.status >= 300) {
		return;
	}

	if (body instanceof Stream) {
		const streamPath = (body as { path?: string }).path;

		if (!streamPath) {
			return;
		}

		return stat(streamPath);
	}

	if (typeof body === 'string' || Buffer.isBuffer(body)) {
		return body;
	}

	return JSON.stringify(body);
};

const buildEtag = (entity: string | Buffer | Stats) => {
	return `W/${isStats(entity) ? statTag(entity) : entityTag(entity)}`;
};

export const etag = (): Middleware => {
	return async (ctx, next) => {
		await next();

		const entity = await getResponseEntity(ctx);

		if (!entity) {
			return;
		}

		ctx.response.etag = buildEtag(entity);
	};
};
