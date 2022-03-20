import {RateLimiterRedis} from 'rate-limiter-flexible';
import {getRedisClient} from './redis/legacy-client.js';

const redisClient = getRedisClient();

export const rateLimiter = new RateLimiterRedis({
	storeClient: redisClient,
	keyPrefix: 'rate',
	points: 100,
	duration: 60,
});

export default rateLimiter;
