import got from 'got';
import { expect } from 'chai';

describe('/adoption-code endpoint', () => {
	it('should send code to the probe', async () => {
		const response = await got.post('http://localhost:80/v1/adoption-code?systemkey=system', { json: {
			ip: '51.158.22.211',
			code: '123456',
		} });
		const body = JSON.parse(response.body);

		expect(response.statusCode).to.equal(200);

		expect(body).to.deep.include({
			city: 'Paris',
			country: 'FR',
			hardwareDevice: null,
			state: null,
			status: 'ready',
		});
	});
});
