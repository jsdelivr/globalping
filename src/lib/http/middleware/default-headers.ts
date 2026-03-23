import type { Middleware } from 'koa';

export const defaultHeaders = (): Middleware => async (ctx, next) => {
	ctx.set('Cache-Control', 'no-store, no-cache, must-revalidate');
	ctx.set('X-Robots-Tag', 'noindex');

	await next();
};
