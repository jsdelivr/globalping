import config from 'config';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { createRedisClient } from './redis/client.js';

const redisClient = await createRedisClient({ legacyMode: true });

export const defaultState = {
	remainingPoints: config.get<number>('measurement.rateLimit'),
	msBeforeNext: config.get<number>('measurement.rateLimitReset') * 1000,
	consumedPoints: 0,
	isFirstInDuration: true,
};

const rateLimiter = new RateLimiterRedis({
	storeClient: redisClient,
	keyPrefix: 'rate',
	points: config.get<number>('measurement.rateLimit'),
	duration: config.get<number>('measurement.rateLimitReset'),
});

export default rateLimiter;
