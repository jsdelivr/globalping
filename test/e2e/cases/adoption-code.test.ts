import got from 'got';
import { expect } from 'chai';

describe('/adoption-code endpoint', () => {
	it('should send code to the probe', async () => {
		const response = await got.post('http://localhost:80/v1/adoption-code?systemkey=system', {
			json: {
				ip: '1.2.3.4',
				code: '123456',
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
