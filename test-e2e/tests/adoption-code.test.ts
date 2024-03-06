import got from 'got';
import { expect } from 'chai';

describe('/adoption-code endpoint', () => {
	it('should send code to the probe', async () => {
		const response = await got.post('http://localhost:3000/v1/adoption-code?systemkey=system', { json: {
			ip: '51.158.22.211',
			code: '123456',
		} });
		const body = JSON.parse(response.body);

		expect(response.statusCode).to.equal(200);

		expect(body).to.deep.include({
			asn: 12876,
			city: 'Paris',
			country: 'FR',
			hardwareDevice: null,
			latitude: 48.8534,
			longitude: 2.3488,
			network: 'SCALEWAY S.A.S.',
			state: null,
			status: 'ready',
		});
	});
});
