import type { Middleware } from 'koa';
import createHttpError from 'http-errors';
import config from 'config';

export const isSystem = (): Middleware => async (ctx, next) => {
	const systemKey = config.get<string>('systemApi.key');
	const isValid = systemKey.length > 0 && ctx.query['systemkey'] === systemKey;

	if (!isValid) {
		throw createHttpError(403, 'Forbidden', { type: 'access_forbidden' });
	} else {
		await next();
	}
};
