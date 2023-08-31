import { LRUCache } from 'lru-cache';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LRUOptions = LRUCache.FetchOptions<object, any, unknown>;

export const throttle = <Value>(func: () => Promise<Value>, time: number) => {
	const cache = new LRUCache({
		max: 1,
		ttl: time,
		fetchMethod: func,
	});
	return (options?: LRUOptions) => cache.fetch('', options) as Promise<Value>;
};
