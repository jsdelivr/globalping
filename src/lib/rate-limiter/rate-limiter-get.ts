import config from 'config';
import { RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible';
import requestIp from 'request-ip';
import { getPersistentRedisClient } from '../redis/persistent-client.js';
import createHttpError from 'http-errors';
import type { ExtendedContext } from '../../types.js';
import type { Next } from 'koa';

const redisClient = getPersistentRedisClient();

export const anonymousRateLimiter = new RateLimiterRedis({
	storeClient: redisClient,
	keyPrefix: 'rate:get:anon',
	points: config.get<number>('measurement.rateLimit.get.anonymousLimit'),
	duration: config.get<number>('measurement.rateLimit.get.reset'),
});

export const authenticatedRateLimiter = new RateLimiterRedis({
	storeClient: redisClient,
	keyPrefix: 'rate:get:auth',
	points: config.get<number>('measurement.rateLimit.get.authenticatedLimit'),
	duration: config.get<number>('measurement.rateLimit.get.reset'),
});

const getRateLimiter = (ctx: ExtendedContext): {
	type: 'user'| 'ip',
	id: string,
	rateLimiter: RateLimiterRedis
} => {
	if (ctx.state.user?.id) {
		return {
			type: 'user',
			id: ctx.state.user.id,
			rateLimiter: authenticatedRateLimiter,
		};
	}

	return {
		type: 'ip',
		id: requestIp.getClientIp(ctx.req) ?? '',
		rateLimiter: anonymousRateLimiter,
	};
};

export const rateLimitMW = async (ctx: ExtendedContext, next: Next) => {
	if (ctx['isAdmin']) {
		return next();
	}

	const { rateLimiter, id } = getRateLimiter(ctx);

	try {
		await rateLimiter.consume(id);
	} catch (error) {
		if (error instanceof RateLimiterRes) {
			setRateLimitHeaders(ctx, error, rateLimiter);
			throw createHttpError(429, 'Too Many Requests', { type: 'too_many_requests' });
		}

		throw createHttpError(500);
	}

	await next();
};

const setRateLimitHeaders = (ctx: ExtendedContext, result: RateLimiterRes, rateLimiter: RateLimiterRedis) => {
};
