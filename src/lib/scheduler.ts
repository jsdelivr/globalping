import { scheduler as nodeScheduler } from 'node:timers/promises';

type ForEachOptions = {
	batchSize?: number;
};

export const run = async <T>(fn: () => T): Promise<T> => {
	try {
		return fn();
	} finally {
		await nodeScheduler.yield();
	}
};

export const forEach = async <T>(items: Iterable<T>, callback: (item: T, index: number) => void, { batchSize = 1000 }: ForEachOptions = {}): Promise<void> => {
	let index = 0;

	for (const item of items) {
		callback(item, index);
		index++;

		if (index % batchSize === 0) {
			await nodeScheduler.yield();
		}
	}

	await nodeScheduler.yield();
};
