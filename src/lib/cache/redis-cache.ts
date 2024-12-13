import { scopedLogger } from '../logger.js';
import type { RedisClient } from '../redis/client.js';
import type { CacheInterface } from './cache-interface.js';

const logger = scopedLogger('redis-cache');

export default class RedisCache implements CacheInterface {
	constructor (private readonly redis: RedisClient) {}

	async set (key: string, value: unknown, ttl: number = 0): Promise<void> {
		try {
			await this.redis.set(this.buildCacheKey(key), JSON.stringify(value), { PX: ttl });
		} catch (error) {
			logger.error('Failed to set redis cache value.', error, { key, ttl });
		}
	}

	async get<T = unknown> (key: string): Promise<T | null> {
		try {
			const raw = await this.redis.get(this.buildCacheKey(key));

			if (!raw) {
				return null;
			}

			return JSON.parse(raw) as T;
		} catch (error) {
			logger.error('Failed to get redis cache value.', error, { key });
			return null;
		}
	}

	async delete<T = unknown> (key: string): Promise<T | null> {
		try {
			const raw = await this.redis.get(this.buildCacheKey(key));

			if (!raw) {
				return null;
			}

			await this.redis.del(this.buildCacheKey(key));

			return JSON.parse(raw) as T;
		} catch (error) {
			logger.error('Failed to del redis cache value.', error, { key });
			return null;
		}
	}

	private buildCacheKey (key: string): string {
		return `gp:cache:${key}`;
	}
}
