import type { Context, Next } from 'koa';
import requestIp from 'request-ip';
import type { RateLimiterRes } from 'rate-limiter-flexible';
import createHttpError from 'http-errors';
import rateLimiter, { defaultState } from '../../ratelimiter.js';
import type { MeasurementRequest } from '../../../measurement/types.js';

const setResponseHeaders = (ctx: Context, response: RateLimiterRes) => {
	ctx.set('X-RateLimit-Reset', `${Math.round(response.msBeforeNext / 1000)}`);
	ctx.set('X-RateLimit-Limit', `${rateLimiter.points}`);
	ctx.set('X-RateLimit-Remaining', `${response.remainingPoints}`);
};

const methodsWhitelist = new Set([ 'GET', 'HEAD', 'OPTIONS' ]);

export const rateLimitHandler = () => async (ctx: Context, next: Next) => {
	const { method, isAdmin } = ctx;
	const clientIp = requestIp.getClientIp(ctx.req) ?? '';
	const request = ctx.request.body as MeasurementRequest;
	const limit = request.locations.some(l => l.limit) ? request.locations.reduce((sum, { limit }) => sum + limit, 0) : request.limit;

	if (methodsWhitelist.has(method) || isAdmin) {
		return next();
	}

	const currentState = await rateLimiter.get(clientIp) ?? defaultState as RateLimiterRes;
	setResponseHeaders(ctx, currentState);

	if (currentState.remainingPoints < limit) {
		setResponseHeaders(ctx, currentState);
		throw createHttpError(429, 'Too Many Probes Requested', { type: 'too_many_probes' });
	}

	await next();
	const response = ctx.response.body as object;

	if (!('probesCount' in response) || typeof response.probesCount !== 'number') {
		throw new Error('Missing probesCount field in response object');
	}

	const newState = await rateLimiter.penalty(clientIp, response.probesCount as number);
	setResponseHeaders(ctx, newState);
};
