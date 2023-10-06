import type { Middleware } from 'koa';
import createHttpError from 'http-errors';

export const onlyAdmin = (): Middleware => {
	return async (ctx, next) => {
		if (!ctx['isAdmin']) {
			throw createHttpError(403, 'Forbidden', { type: 'access_forbidden' });
		} else {
			await next();
		}
	};
};
