import type {Context, Next} from 'koa';
import requestIp from 'request-ip';
import type {RateLimiterRes} from 'rate-limiter-flexible';

import rateLimiter from '../../ratelimiter.js';

const setResponseHeaders = (ctx: Context, response: RateLimiterRes) => {
	const resetDate = new Date(Date.now() + response.msBeforeNext);

	ctx.set('X-RateLimit-Reset-After', `${response.msBeforeNext / 1000}s`);
	ctx.set('X-RateLimit-Limit', `${rateLimiter.points}`);
	ctx.set('X-RateLimit-Remaining', `${response.remainingPoints}`);
	ctx.set('X-RateLimit-Reset', `${resetDate.toISOString()}`);
};

// eslint-disable-next-line unicorn/prevent-abbreviations
const methodsWhitelist = new Set(['GET', 'HEAD', 'OPTIONS']);

export const rateLimitHandler = () => async (ctx: Context, next: Next) => {
	if (methodsWhitelist.has(ctx.method)) {
		return next();
	}

	try {
		const response = await rateLimiter.consume(requestIp.getClientIp(ctx.req)!);
		setResponseHeaders(ctx, response);
	} catch (error: unknown) { // Ts requires 'unknown' for errors
		setResponseHeaders(ctx, error as RateLimiterRes);
		ctx.status = 429;
		ctx.body = 'Too Many Requests';
		return;
	}

	await next();
};
