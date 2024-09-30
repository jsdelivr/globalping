import got from 'got';
import { expect } from 'chai';
import { getPersistentRedisClient } from '../../../src/lib/redis/persistent-client.js';

describe('/limits endpoint', () => {
	const redis =	getPersistentRedisClient();

	before(async () => {
		const keys = await redis.keys('rate:post:anon:*');
		await redis.del(keys);
	});

	it('should return a default limits object', async () => {
		const response = await got('http://localhost:80/v1/limits', {
			responseType: 'json',
		});

		expect(response.statusCode).to.equal(200);

		expect(response.body).to.deep.equal({
			rateLimit: {
				measurements: {
					create: {
						type: 'ip',
						limit: 100000,
						remaining: 100000,
						reset: 0,
					},
				},
			},
		});
	});

	it('should return an active limits object', async () => {
		await got.post('http://localhost:80/v1/measurements', { json: {
			target: 'www.jsdelivr.com',
			type: 'ping',
		} });

		const response = await got<any>('http://localhost:80/v1/limits', {
			responseType: 'json',
		});

		expect(response.statusCode).to.equal(200);
		expect(response.body.rateLimit.measurements.create.reset).to.be.a('number');

		expect(response.body.rateLimit.measurements.create).to.deep.include({
			type: 'ip',
			limit: 100000,
			remaining: 99999,
		});
	});
});
