import type { Middleware } from 'koa';

export const defaultHeaders = (): Middleware => async (ctx, next) => {
	ctx.set('Cache-Control', 'private, no-store, no-cache, must-revalidate');
	ctx.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
	ctx.set('X-Robots-Tag', 'noindex');

	await next();
};
