import config from 'config';
import type { Context, Next } from 'koa';
import requestIp from 'request-ip';
import type { RateLimiterRes } from 'rate-limiter-flexible';

import rateLimiter from '../../ratelimiter.js';

const setResponseHeaders = (ctx: Context, response: RateLimiterRes) => {
	ctx.set('X-RateLimit-Reset', `${Math.round(response.msBeforeNext / 1000)}`);
	ctx.set('X-RateLimit-Limit', `${rateLimiter.points}`);
	ctx.set('X-RateLimit-Remaining', `${response.remainingPoints}`);
};

const methodsWhitelist = new Set([ 'GET', 'HEAD', 'OPTIONS' ]);

export const rateLimitHandler = () => async (ctx: Context, next: Next) => {
	const { method, isAdmin } = ctx;

	if (methodsWhitelist.has(method) || isAdmin) {
		return next();
	}

	const defaultState = {
		remainingPoints: config.get<number>('measurement.rateLimit'),
		msBeforeNext: config.get<number>('measurement.rateLimitResetMs'),
		consumedPoints: 0,
		isFirstInDuration: true,
	};
	const currentState = await rateLimiter.get(requestIp.getClientIp(ctx.req) ?? '') ?? defaultState;

	if (currentState.remainingPoints >= ctx.request.body.limit) {
		await next();
		const newState = await rateLimiter.penalty(requestIp.getClientIp(ctx.req) ?? '', ctx.response.body.probesCount);
		setResponseHeaders(ctx, newState);
	} else {
		setResponseHeaders(ctx, currentState);
		ctx.status = 429;
		ctx.body = 'Too Many Requests';
		return;
	}

	const data = await rateLimiter.get(requestIp.getClientIp(ctx.req) ?? '');
	console.log('data', data);
};
