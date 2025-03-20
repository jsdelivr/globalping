import got from 'got';
import { expect } from 'chai';
import { client } from '../../../src/lib/sql/client.js';

describe('/adoption-code endpoint', () => {
	after(async () => {
		await client('gp_probes').delete();
	});

	it('should send code to the probe', async () => {
		const response = await got.post('http://localhost:80/v1/adoption-code', {
			json: {
				ip: '1.2.3.4',
				code: '123456',
			},
			headers: {
				'X-Api-Key': 'system',
			},
			responseType: 'json',
		});

		expect(response.statusCode).to.equal(200);

		expect(response.body).to.deep.include({
			city: 'Buenos Aires',
			country: 'AR',
			hardwareDevice: null,
			hardwareDeviceFirmware: null,
			state: null,
			status: 'ready',
		});
	});
});
