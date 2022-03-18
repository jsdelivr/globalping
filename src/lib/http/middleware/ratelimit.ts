import type {Context, Next} from 'koa';
import requestIp from 'request-ip';
import {RateLimiterRedis} from '../../ratelimit/redis.js';

import {getRedisClient} from '../../redis/client.js';

const redisClient = getRedisClient();

const rateLimiter = new RateLimiterRedis({
	storeClient: redisClient,
	keyPrefix: 'rate',
	points: 100,
	duration: 60,
});

// eslint-disable-next-line unicorn/prevent-abbreviations
const methodsWhitelist = new Set(['GET', 'HEAD', 'OPTIONS']);

export const rateLimitHandler = () => async (ctx: Context, next: Next) => {
	if (methodsWhitelist.has(ctx.method)) {
		return next();
	}

	try {
		await rateLimiter.consume(requestIp.getClientIp(ctx.req)!);
	} catch {
		ctx.status = 429;
		ctx.body = 'Too Many Requests';
		return;
	}

	await next();
};
