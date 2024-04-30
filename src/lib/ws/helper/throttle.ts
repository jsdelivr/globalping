import { LRUCache } from 'lru-cache';

export const throttle = <Value extends NonNullable<unknown>>(func: () => Promise<Value | void>, time: number, maxStale?: number) => {
	type FetchOptions = LRUCache.FetchOptions<object, Value, unknown>;

	const cache = new LRUCache({
		max: 1,
		ttl: time,
		fetchMethod: func,
	});

	return (options?: FetchOptions) => {
		const allowStale = maxStale ? cache.getRemainingTTL('') > -maxStale : false;
		const newOptions: FetchOptions = Object.assign({ allowStale }, options);

		return cache.fetch('', newOptions) as Promise<Value>;
	};
};
