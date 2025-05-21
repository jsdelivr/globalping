import type { CacheInterface } from './cache-interface.js';

export default class NullCache implements CacheInterface {
	async delete (): Promise<null> {
		return null;
	}

	async get (): Promise<null> {
		return null;
	}

	async set (): Promise<void> {}
}
