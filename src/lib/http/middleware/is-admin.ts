import type { UnknownNext } from '../../../types.js';
import type { Context } from 'koa';
import config from 'config';

export const isAdminMw = async (ctx: Context, next: UnknownNext) => {
	const adminKey = config.get<string>('admin.key');
	ctx['isAdmin'] = adminKey.length > 0 && ctx.query['adminkey'] === adminKey;
	return next();
};
