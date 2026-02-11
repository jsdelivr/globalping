import { setTimeout } from 'node:timers/promises';

export const waitFor = async (fn: () => unknown, interval = 20) => {
	while (!await fn()) {
		await setTimeout(interval);
	}
};
