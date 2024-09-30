import config from 'config';
import { RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible';
import requestIp from 'request-ip';
import { getPersistentRedisClient } from '../redis/persistent-client.js';
import createHttpError from 'http-errors';
import type { ExtendedContext } from '../../types.js';
import type { Next } from 'koa';

const redisClient = getPersistentRedisClient();

export const rateLimiter = new RateLimiterRedis({
	storeClient: redisClient,
	keyPrefix: 'rate:get',
	points: config.get<number>('measurement.rateLimit.getPerMeasurement.limit'),
	duration: config.get<number>('measurement.rateLimit.getPerMeasurement.reset'),
	blockDuration: 5,
});

export const getMeasurementRateLimit = async (ctx: ExtendedContext, next: Next) => {
	if (ctx['isAdmin']) {
		return next();
	}

	const ip = requestIp.getClientIp(ctx.req) ?? '';
	const measurementId = ctx.params['id'] ?? '';
	const id = `${ip}:${measurementId}`;

	try {
		await rateLimiter.consume(id);
	} catch (error) {
		if (error instanceof RateLimiterRes) {
			const retryAfter = Math.ceil(error.msBeforeNext / 1000);
			const units = retryAfter === 1 ? 'second' : 'seconds';

			setRateLimitHeaders(ctx, error);
			throw createHttpError(429, `Too many requests. Please retry in ${retryAfter} ${units}.`, { type: 'too_many_requests' });
		}

		throw createHttpError(500);
	}

	await next();
};

const setRateLimitHeaders = (ctx: ExtendedContext, error: RateLimiterRes) => {
	ctx.set('Retry-After', `${Math.ceil(error.msBeforeNext / 1000)}`);
};
