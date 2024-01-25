import config from 'config';
import type { Context } from 'koa';
import { RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible';
import requestIp from 'request-ip';
import { createPersistentRedisClient } from './redis/persistent-client.js';
import createHttpError from 'http-errors';

const redisClient = await createPersistentRedisClient({ legacyMode: true });

const rateLimiter = new RateLimiterRedis({
	storeClient: redisClient,
	keyPrefix: 'rate',
	points: config.get<number>('measurement.rateLimit'),
	duration: config.get<number>('measurement.rateLimitReset'),
});

const setRateLimitHeaders = (ctx: Context, result: RateLimiterRes) => {
	ctx.set('X-RateLimit-Reset', `${Math.round(result.msBeforeNext / 1000)}`);
	ctx.set('X-RateLimit-Limit', `${rateLimiter.points}`);
	ctx.set('X-RateLimit-Remaining', `${result.remainingPoints}`);
};

export const rateLimit = async (ctx: Context, numberOfProbes: number) => {
	if (ctx['isAdmin']) {
		return;
	}

	const clientIp = requestIp.getClientIp(ctx.req) ?? '';

	try {
		const result = await rateLimiter.consume(clientIp, numberOfProbes);
		setRateLimitHeaders(ctx, result);
	} catch (error) {
		if (error instanceof RateLimiterRes) {
			const result = await rateLimiter.reward(clientIp, numberOfProbes);
			setRateLimitHeaders(ctx, result);
			throw createHttpError(429, 'Too Many Probes Requested', { type: 'too_many_probes' });
		}

		throw createHttpError(500);
	}
};

export default rateLimiter;
