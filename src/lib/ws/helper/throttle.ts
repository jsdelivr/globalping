import { LRUCache } from 'lru-cache';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LRUOptions = LRUCache.FetchOptions<object, any, unknown>;

export const throttle = <Value>(func: () => Promise<Value>, time: number, maxStale?: number) => {
	const cache = new LRUCache({
		max: 1,
		ttl: time,
		fetchMethod: func,
	});

	return (options?: LRUOptions) => {
		const allowStale = maxStale ? cache.getRemainingTTL('') > -maxStale : false;
		const newOptions: LRUCache.FetchOptions<object, Value, unknown> = Object.assign({ allowStale }, options);

		return cache.fetch('', newOptions) as Promise<Value>;
	};
};
