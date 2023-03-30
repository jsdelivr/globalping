import type { Context, Next } from 'koa';

export const corsHandler = () => async (ctx: Context, next: Next) => {
	ctx.set('Access-Control-Allow-Origin', '*');
	ctx.set('Access-Control-Allow-Headers', '*, Authorization');
	ctx.set('Access-Control-Expose-Headers', '*');
	ctx.set('Cross-Origin-Resource-Policy', 'cross-origin');
	ctx.set('Timing-Allow-Origin', '*');
	ctx.set('Vary', 'Accept-Encoding');

	return next();
};
