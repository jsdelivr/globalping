import Redis from 'ioredis';

// eslint-disable-next-line @typescript-eslint/naming-convention
export default class GPRedis extends Redis {
	async * scanIterator(match: string, count = 10) {
		let cursor = 0;
		do {
			// eslint-disable-next-line no-await-in-loop
			const result = await this.call('SCAN', cursor, 'MATCH', match, 'count', count) as [string, string[]];
			cursor = Number(result[0]);
			for (const item of result[1]) {
				yield item;
			}
		} while (cursor !== 0);
	}
}
