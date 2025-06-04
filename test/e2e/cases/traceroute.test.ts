import got from 'got';
import { expect } from 'chai';
import { waitMeasurementFinish } from '../utils.js';

describe('traceroute measurement', () => {
	it('should finish successfully', async () => {
		const { id } = await got.post('http://localhost:80/v1/measurements', {
			json: {
				target: 'www.jsdelivr.com',
				type: 'traceroute',
			},
		}).json<any>();

		const response = await waitMeasurementFinish(id);

		expect(response.body.status).to.equal('finished');
		expect(response.body.results[0].result.status).to.equal('finished');
		expect(response).to.matchApiSchema();
	});

	it('should finish successfully in case of IPv6 domain target', async () => {
		const { id } = await got.post('http://localhost:80/v1/measurements', {
			json: {
				target: 'www.jsdelivr.com',
				type: 'traceroute',
				measurementOptions: {
					ipVersion: 6,
				},
			},
		}).json<any>();

		const response = await waitMeasurementFinish(id);

		expect(response.body.status).to.equal('finished');
		expect(response.body.results[0].result.status).to.equal('finished');
		expect(response).to.matchApiSchema();
	});

	it('should finish successfully in case of IPv6 address target', async () => {
		const { id } = await got.post('http://localhost:80/v1/measurements', {
			json: {
				target: '2606:4700:3037::ac43:d071',
				type: 'traceroute',
			},
		}).json<any>();

		const response = await waitMeasurementFinish(id);

		expect(response.body.status).to.equal('finished');
		expect(response.body.results[0].result.status).to.equal('finished');
		expect(response).to.matchApiSchema();
	});

	it('should return 400 for blacklisted target', async () => {
		const response = await got.post('http://localhost:80/v1/measurements', {
			json: {
				target: 'google-ads.xyz',
				type: 'traceroute',
			},
			throwHttpErrors: false,
		});

		expect(response.statusCode).to.equal(400);
	});
});
