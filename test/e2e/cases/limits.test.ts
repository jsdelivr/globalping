import got from 'got';
import { expect } from 'chai';

describe('/limits endpoint', () => {
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
						consumed: 0,
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

		const response2 = await got<any>('http://localhost:80/v1/limits', {
			responseType: 'json',
		});

		expect(response2.statusCode).to.equal(200);
		expect(response2.body.rateLimit.measurements.create.reset).to.be.a('number');

		expect(response2.body.rateLimit.measurements.create).to.deep.include({
			type: 'ip',
			limit: 100000,
			consumed: 1,
			remaining: 99999,
		});
	});
});
