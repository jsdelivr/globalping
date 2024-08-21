import type { Context, Next } from 'koa';

export const corsHandler = () => async (ctx: Context, next: Next) => {
	ctx.set('Access-Control-Allow-Origin', '*');
	ctx.set('Access-Control-Allow-Headers', '*');
	ctx.set('Access-Control-Expose-Headers', '*');
	ctx.set('Access-Control-Max-Age', '600');
	ctx.set('Cross-Origin-Resource-Policy', 'cross-origin');
	ctx.set('Timing-Allow-Origin', '*');
	ctx.set('Vary', 'Accept-Encoding');

	return next();
};

export const corsAuthHandler = ({ trustedOrigins = [] }: CorsOptions) => {
	const exposeHeaders = [
		'ETag',
		'Link',
		'Location',
		'Retry-After',
		'X-RateLimit-Limit',
		'X-RateLimit-Consumed',
		'X-RateLimit-Remaining',
		'X-RateLimit-Reset',
		'X-Credits-Consumed',
		'X-Credits-Remaining',
		'X-Request-Cost',
		'X-Response-Time',
		'Deprecation',
		'Sunset',
	].join(', ');

	return async (ctx: Context, next: Next) => {
		const origin = ctx.get('Origin');

		// Allow credentials only if the request is coming from a trusted origin.
		if (trustedOrigins.includes(origin)) {
			ctx.set('Access-Control-Allow-Origin', ctx.get('Origin'));
			ctx.set('Access-Control-Allow-Credentials', 'true');
			ctx.set('Vary', 'Accept-Encoding, Origin');
		}

		ctx.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
		ctx.set('Access-Control-Expose-Headers', exposeHeaders);

		return next();
	};
};

export type CorsOptions = { trustedOrigins?: string[] };
