import config from 'config';
import { RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible';
import requestIp from 'request-ip';
import { createPersistentRedisClient } from './redis/persistent-client.js';
import createHttpError from 'http-errors';
import type { ExtendedContext } from '../types.js';
import { credits } from './credits.js';

const redisClient = createPersistentRedisClient();

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
				const { isConsumed, requiredCredits, remainingCredits } = await consumeCredits(ctx.state.userId, error, numberOfProbes);

				if (isConsumed) {
					const result = await rateLimiter.reward(id, requiredCredits);
					setConsumedHeaders(ctx, requiredCredits, remainingCredits);
					setRateLimitHeaders(ctx, result, rateLimiter);
					return;
				}

				setRequiredHeaders(ctx, requiredCredits, remainingCredits);
			}

			const result = await rateLimiter.reward(id, numberOfProbes);
			setRateLimitHeaders(ctx, result, rateLimiter);
			throw createHttpError(429, 'Too Many Probes Requested', { type: 'too_many_probes' });
		}

		throw createHttpError(500);
	}
};

const consumeCredits = async (userId: string, rateLimiterRes: RateLimiterRes, numberOfProbes: number) => {
	const freeCredits = config.get<number>('measurement.authenticatedRateLimit');
	const requiredCredits = Math.min(rateLimiterRes.consumedPoints - freeCredits, numberOfProbes);
	const { isConsumed, remainingCredits } = await credits.consume(userId, requiredCredits);

	return {
		isConsumed,
		requiredCredits,
		remainingCredits,
	};
};

const setRateLimitHeaders = (ctx: ExtendedContext, result: RateLimiterRes, rateLimiter: RateLimiterRedis) => {
	ctx.set('X-RateLimit-Reset', `${Math.round(result.msBeforeNext / 1000)}`);
	ctx.set('X-RateLimit-Limit', `${rateLimiter.points}`);
	ctx.set('X-RateLimit-Remaining', `${result.remainingPoints}`);
};

const setConsumedHeaders = (ctx: ExtendedContext, consumedCredits: number, remainingCredits: number) => {
	ctx.set('X-Credits-Consumed', `${consumedCredits}`);
	ctx.set('X-Credits-Remaining', `${remainingCredits}`);
};

const setRequiredHeaders = (ctx: ExtendedContext, requiredCredits: number, remainingCredits: number) => {
	ctx.set('X-Credits-Required', `${requiredCredits}`);
	ctx.set('X-Credits-Remaining', `${remainingCredits}`);
};
