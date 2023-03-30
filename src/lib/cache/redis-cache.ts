import type { RedisClient } from '../redis/client.js';
import type { CacheInterface } from './cache-interface.js';

export default class RedisCache implements CacheInterface {
	constructor (private readonly redis: RedisClient) {}

	async set (key: string, value: unknown, ttl?: number): Promise<void> {
		await this.redis.set(this.buildCacheKey(key), JSON.stringify(value), { EX: ttl ? ttl / 1000 : 0 });
	}

	async get<T = unknown> (key: string): Promise<T | undefined> {
		const raw = await this.redis.get(this.buildCacheKey(key));

		if (!raw) {
			return;
		}

		return JSON.parse(raw) as T;
	}

	async delete<T = unknown> (key: string): Promise<T | undefined> {
		const raw = await this.redis.get(this.buildCacheKey(key));

		if (!raw) {
			return undefined;
		}

		await this.redis.del(this.buildCacheKey(key));

		return JSON.parse(raw) as T;
	}

	private buildCacheKey (key: string): string {
		return `gp:cache:${key}`;
	}
}
