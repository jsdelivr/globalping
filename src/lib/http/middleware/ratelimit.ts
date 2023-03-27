import type {Context, Next} from 'koa';
import requestIp from 'request-ip';
import type {RateLimiterRes} from 'rate-limiter-flexible';

import rateLimiter from '../../ratelimiter.js';

const setResponseHeaders = (ctx: Context, response: RateLimiterRes) => {
	ctx.set('X-RateLimit-Reset', `${Math.round(response.msBeforeNext / 1000)}`);
	ctx.set('X-RateLimit-Limit', `${rateLimiter.points}`);
	ctx.set('X-RateLimit-Remaining', `${response.remainingPoints}`);
};

const methodsWhitelist = new Set(['GET', 'HEAD', 'OPTIONS']);

export const rateLimitHandler = () => async (ctx: Context, next: Next) => {
	const {method, isAdmin} = ctx;
	if (methodsWhitelist.has(method) || isAdmin) {
		return next();
	}

	try {
		const response = await rateLimiter.consume(requestIp.getClientIp(ctx.req) ?? '');
		setResponseHeaders(ctx, response);
	} catch (error: unknown) { // Ts requires 'unknown' for errors
		setResponseHeaders(ctx, error as RateLimiterRes);
		ctx.status = 429;
		ctx.body = 'Too Many Requests';
		return;
	}

	await next();
};
