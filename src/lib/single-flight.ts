import { captureSpan } from './metrics.js';

const inflight = new Map();

export const scopedFlight = (scope: string) => {
	return <T>(key: string, fn: (key: string) => Promise<T>) => {
		const scopedKey = `${scope}:${key}`;
		const cachedResult = inflight.get(scopedKey) as Promise<T> | undefined;

		if (cachedResult) {
			return captureSpan('singleFlight', () => cachedResult);
		}

		const newResult = fn(key);
		inflight.set(scopedKey, cachedResult);

		return newResult.finally(() => {
			inflight.delete(scopedKey);
		});
	};
};
