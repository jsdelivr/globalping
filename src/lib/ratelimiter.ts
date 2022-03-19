import {RateLimiterRedis} from './ratelimit/redis.js';
import {getRedisClient} from './redis/client.js';

const redisClient = getRedisClient();

export const rateLimiter = new RateLimiterRedis({
	storeClient: redisClient,
	keyPrefix: 'rate',
	points: 100,
	duration: 60,
});

export default rateLimiter;
