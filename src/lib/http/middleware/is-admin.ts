import type { Context, Next } from 'koa';
import config from 'config';

export const isAdminMw = async (ctx: Context, next: Next) => {
	const adminKey = config.get<string>('admin.key');
	ctx['isAdmin'] = adminKey.length > 0 && ctx.query['adminkey'] === adminKey;
	return next();
};
