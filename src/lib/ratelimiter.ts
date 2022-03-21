import {RateLimiterRedis} from 'rate-limiter-flexible';
import {createRedisClient} from './redis/client.js';

const redisClient = await createRedisClient({legacyMode: true});

export const rateLimiter = new RateLimiterRedis({
	storeClient: redisClient,
	keyPrefix: 'rate',
	points: 100,
	duration: 60,
});

export default rateLimiter;
