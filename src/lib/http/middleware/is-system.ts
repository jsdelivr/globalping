import type { Middleware } from 'koa';
import config from 'config';

export const isSystemMw: Middleware = async (ctx, next) => {
	const systemKey = config.get<string>('systemApi.key');
	ctx['isSystem'] = systemKey.length > 0 && ctx.query['systemkey'] === systemKey;
	return next();
};
