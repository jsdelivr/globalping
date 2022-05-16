import type {CacheInterface} from './cache-interface.js';

export default class NullCache implements CacheInterface {
	async delete(): Promise<undefined> {
		return undefined;
	}

	async get(): Promise<undefined> {
		return undefined;
	}

	// eslint-disable-next-line @typescript-eslint/no-empty-function
	async set(): Promise<void> {}
}
