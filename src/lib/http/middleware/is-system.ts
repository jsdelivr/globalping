import type { UnknownNext } from '../../../types.js';
import type { Middleware } from 'koa';
import config from 'config';

const systemKey = config.get<string>('systemApi.key');

export const isSystemMw: Middleware = async (ctx, next: UnknownNext) => {
	ctx['isSystem'] = ctx.headers['x-api-key'] === systemKey;
	return next();
};
