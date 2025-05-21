import config from 'config';
import { RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible';
import requestIp from 'request-ip';
import { getPersistentRedisClient } from '../redis/persistent-client.js';
import createHttpError from 'http-errors';
import type { ExtendedContext } from '../../types.js';
import { credits } from '../credits.js';

const redisClient = getPersistentRedisClient();

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
		id: ctx.state.user?.hashedToken ?? requestIp.getClientIp(ctx.req) ?? '',
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
	const { isConsumed, remainingCredits } = await credits.consume(userId, requiredCredits);

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
