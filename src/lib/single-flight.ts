const inflight = new Map();

export const scopedFlight = (scope: string) => {
	return <T>(key: string, fn: (key: string) => Promise<T>) => {
		const scopedKey = `${scope}:${key}`;
		let result = inflight.get(scopedKey) as Promise<T> | undefined;

		if (result) {
			return result;
		}

		result = fn(key);
		inflight.set(scopedKey, result);

		return result.finally(() => {
			inflight.delete(scopedKey);
		});
	};
};
