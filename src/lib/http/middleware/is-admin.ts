import type { UnknownNext } from '../../../types.js';
import type { Middleware } from 'koa';
import config from 'config';

export const isAdminMw: Middleware = async (ctx, next: UnknownNext) => {
	const adminKey = config.get<string>('admin.key');
	ctx['isAdmin'] = adminKey.length > 0 && ctx.query['adminkey'] === adminKey;
	return next();
};
