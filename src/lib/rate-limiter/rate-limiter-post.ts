import config from 'config';
import TTLCache from '@isaacs/ttlcache';
import { RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible';
import { getPersistentRedisClient } from '../redis/persistent-client.js';
import createHttpError from 'http-errors';
import type { ExtendedContext } from '../../types.js';
import { credits } from '../credits.js';
import { getIdFromRequest } from './get-id-from-request.js';

type FailedCreditsAttemptValue = {
	requiredCredits: number;
	remainingCredits: number;
};

const redisClient = getPersistentRedisClient();

export const failedCreditsAttempts = new TTLCache<string, FailedCreditsAttemptValue>({ ttl: 60_000 });

export const anonymousRateLimiter = new RateLimiterRedis({
	storeClient: redisClient,
	keyPrefix: 'rate:post:anon',
	points: config.get<number>('measurement.rateLimit.post.anonymousLimit'),
	duration: config.get<number>('measurement.rateLimit.post.reset'),
});

export const authenticatedRateLimiter = new RateLimiterRedis({
	storeClient: redisClient,
	keyPrefix: 'rate:post:auth',
	points: config.get<number>('measurement.rateLimit.post.authenticatedLimit'),
	duration: config.get<number>('measurement.rateLimit.post.reset'),
});

const getRateLimiter = (ctx: ExtendedContext): {
	type: 'user' | 'ip';
	id: string;
	rateLimiter: RateLimiterRedis;
} => {
	if (ctx.state.user?.id) {
		return {
			type: 'user',
			id: ctx.state.user.id ?? '',
			rateLimiter: authenticatedRateLimiter,
		};
	}

	return {
		type: 'ip',
		id: ctx.state.user?.hashedToken ?? getIdFromRequest(ctx.request),
		rateLimiter: anonymousRateLimiter,
	};
};

export const rateLimit = async (ctx: ExtendedContext, numberOfProbes: number) => {
	if (ctx['isAdmin']) {
		return;
	}

	const { rateLimiter, id } = getRateLimiter(ctx);
	setRequestCostHeaders(ctx, numberOfProbes);

	try {
		const result = await rateLimiter.consume(id, numberOfProbes);
		setRateLimitHeaders(ctx, result, rateLimiter, numberOfProbes);
	} catch (error) {
		if (error instanceof RateLimiterRes) {
			if (ctx.state.user?.id) {
				const { isConsumed, requiredCredits, remainingCredits } = await consumeCredits(ctx.state.user.id, error, numberOfProbes);

				if (isConsumed) {
					const result = await rateLimiter.reward(id, requiredCredits);
					setCreditsConsumedHeaders(ctx, requiredCredits, remainingCredits);
					setRateLimitHeaders(ctx, result, rateLimiter, numberOfProbes - requiredCredits);
					return;
				}

				setCreditsConsumedHeaders(ctx, 0, remainingCredits);
			}

			const result = await rateLimiter.reward(id, numberOfProbes);
			setRateLimitHeaders(ctx, result, rateLimiter, 0);
			throw createHttpError(429, 'Too Many Probes Requested', { type: 'too_many_probes' });
		}

		throw createHttpError(500);
	}
};

export const getRateLimitState = async (ctx: ExtendedContext) => {
	const { rateLimiter, id, type } = getRateLimiter(ctx);
	const rateLimiterRes = await rateLimiter.get(id);

	if (rateLimiterRes) {
		return {
			type,
			limit: rateLimiter.points,
			remaining: rateLimiterRes.remainingPoints,
			reset: Math.round(rateLimiterRes.msBeforeNext / 1000),
		};
	} else if (type === 'user') {
		return {
			type,
			limit: config.get<number>('measurement.rateLimit.post.authenticatedLimit'),
			remaining: config.get<number>('measurement.rateLimit.post.authenticatedLimit'),
			reset: 0,
		};
	}

	return {
		type,
		limit: config.get<number>('measurement.rateLimit.post.anonymousLimit'),
		remaining: config.get<number>('measurement.rateLimit.post.anonymousLimit'),
		reset: 0,
	};
};

const consumeCredits = async (userId: string, rateLimiterRes: RateLimiterRes, numberOfProbes: number) => {
	const freeCredits = config.get<number>('measurement.rateLimit.post.authenticatedLimit');
	const requiredCredits = Math.min(rateLimiterRes.consumedPoints - freeCredits, numberOfProbes);
	const attempt = failedCreditsAttempts.get(userId);

	// If there was a recent attempt to use credits, and it failed, and requiredCredits is same or higher, reject immediately.
	if (attempt && requiredCredits >= attempt.requiredCredits) {
		return {
			isConsumed: false,
			requiredCredits,
			remainingCredits: attempt.remainingCredits, // This can technically be off a little if another request with lower requiredCredits succeeded in the meantime, but that's ok.
		};
	}

	const { isConsumed, remainingCredits } = await credits.consume(userId, requiredCredits);

	if (!isConsumed) {
		failedCreditsAttempts.set(userId, { requiredCredits, remainingCredits });
	}

	return {
		isConsumed,
		requiredCredits,
		remainingCredits,
	};
};

const setRateLimitHeaders = (ctx: ExtendedContext, result: RateLimiterRes, rateLimiter: RateLimiterRedis, requestConsumedPoints: number) => {
	ctx.set('X-RateLimit-Reset', `${Math.round(result.msBeforeNext / 1000)}`);
	ctx.set('X-RateLimit-Limit', `${rateLimiter.points}`);
	ctx.set('X-RateLimit-Consumed', `${requestConsumedPoints}`);
	ctx.set('X-RateLimit-Remaining', `${result.remainingPoints}`);
};

const setCreditsConsumedHeaders = (ctx: ExtendedContext, consumedCredits: number, remainingCredits: number) => {
	ctx.set('X-Credits-Consumed', `${consumedCredits}`);
	ctx.set('X-Credits-Remaining', `${remainingCredits}`);
};

const setRequestCostHeaders = (ctx: ExtendedContext, requestCost: number) => {
	ctx.set('X-Request-Cost', `${requestCost}`);
};
