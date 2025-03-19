import type { Middleware } from 'koa';
import config from 'config';

const systemKey = config.get<string>('systemApi.key');

export const isSystemMw: Middleware = async (ctx, next) => {
	ctx['isSystem'] = false;
	const authorization = ctx.headers.authorization;

	if (authorization) {
		const parts = authorization.split(' ');

		if (parts.length === 2 && parts[0] === 'Bearer' && parts[1] === systemKey) {
			ctx['isSystem'] = true;
		}
	}

	return next();
};
