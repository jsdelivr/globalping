import {getRedisClient} from './redis/client.js';

const redisClient = getRedisClient();

const getCacheKey = (key: string): string => `gp:cache:${key}`;

export const set = async (key: string, value: unknown, ttl: number | undefined = undefined): Promise<void> => {
	// eslint-disable-next-line @typescript-eslint/naming-convention
	await redisClient.set(getCacheKey(key), JSON.stringify(value), {EX: ttl ?? 0});
};

export const get = async <T = unknown>(key: string): Promise<T | undefined> => {
	const raw = await redisClient.get(getCacheKey(key));

	if (!raw) {
		return undefined;
	}

	return JSON.parse(raw) as T;
};

export const del = async <T = unknown>(key: string): Promise<T | undefined> => {
	const raw = await redisClient.get(getCacheKey(key));

	if (!raw) {
		return undefined;
	}

	await redisClient.del(getCacheKey(key));

	return JSON.parse(raw) as T;
};
