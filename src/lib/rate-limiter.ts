import config from 'config';
import type { Context } from 'koa';
import { RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible';
import requestIp from 'request-ip';
import { createPersistentRedisClient } from './redis/persistent-client.js';
import createHttpError from 'http-errors';
import type { ExtendedContext } from '../types.js';
import { credits } from './credits.js';

const redisClient = await createPersistentRedisClient({ legacyMode: true });

export const anonymousRateLimiter = new RateLimiterRedis({
	storeClient: redisClient,
	keyPrefix: 'rate:anon',
	points: config.get<number>('measurement.anonymousRateLimit'),
	duration: config.get<number>('measurement.rateLimitReset'),
});

export const authenticatedRateLimiter = new RateLimiterRedis({
	storeClient: redisClient,
	keyPrefix: 'rate:auth',
	points: config.get<number>('measurement.authenticatedRateLimit'),
	duration: config.get<number>('measurement.rateLimitReset'),
});

export const rateLimit = async (ctx: ExtendedContext, numberOfProbes: number) => {
	if (ctx['isAdmin']) {
		return;
	}

	let rateLimiter: RateLimiterRedis;
	let id: string;

	if (ctx.state.userId) {
		rateLimiter = authenticatedRateLimiter;
		id = ctx.state.userId;
	} else {
		rateLimiter = anonymousRateLimiter;
		id = requestIp.getClientIp(ctx.req) ?? '';
	}

	try {
		const result = await rateLimiter.consume(id, numberOfProbes);
		setRateLimitHeaders(ctx, result, rateLimiter);
	} catch (error) {
		if (error instanceof RateLimiterRes) {
			if (ctx.state.userId) {
				const { success, pointsToReward } = await consumeCredits(ctx.state.userId, error, numberOfProbes);

				if (success) {
					const result = await rateLimiter.reward(id, pointsToReward);
					setRateLimitHeaders(ctx, result, rateLimiter);
					return;
				}
			}

			const result = await rateLimiter.reward(id, numberOfProbes);
			setRateLimitHeaders(ctx, result, rateLimiter);
			throw createHttpError(429, 'Too Many Probes Requested', { type: 'too_many_probes' });
		}

		throw createHttpError(500);
	}
};

const setRateLimitHeaders = (ctx: Context, result: RateLimiterRes, rateLimiter: RateLimiterRedis) => {
	ctx.set('X-RateLimit-Reset', `${Math.round(result.msBeforeNext / 1000)}`);
	ctx.set('X-RateLimit-Limit', `${rateLimiter.points}`);
	ctx.set('X-RateLimit-Remaining', `${result.remainingPoints}`);
};

const consumeCredits = async (userId: string, error: RateLimiterRes, numberOfProbes: number) => {
	const freePoints = config.get<number>('measurement.authenticatedRateLimit');
	const alreadyUsedPoints = error.consumedPoints - numberOfProbes;
	const remainingFreePoints = freePoints - alreadyUsedPoints;
	const requiredPoints = numberOfProbes - remainingFreePoints;
	const success = await credits.consume(userId, requiredPoints);

	return { success, pointsToReward: numberOfProbes - remainingFreePoints };
};
