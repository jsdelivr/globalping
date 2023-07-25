import { LRUCache } from 'lru-cache';

const throttle = <Value>(func: () => Promise<Value>, time: number) => {
	const cache = new LRUCache({
		max: 1,
		ttl: time,
		fetchMethod: func,
	});
	return (options?: {forceRefresh: true}) => cache.fetch('', options) as Promise<Value>;
};

export default throttle;
