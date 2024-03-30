import got from 'got';
import { expect } from 'chai';
import { waitMesurementFinish } from '../utils.js';

describe('http mesurement', () => {
	it('should finish successfully', async () => {
		const { id } = await got.post('http://localhost:80/v1/measurements', { json: {
			target: 'www.jsdelivr.com',
			type: 'http',
		} }).json();

		const response = await waitMesurementFinish(id);

		expect(response.body.status).to.equal('finished');
		expect(response.body.results[0].result.status).to.equal('finished');
		expect(response.body.results[0].result.rawBody).to.equal(null);
		expect(response).to.matchApiSchema();
	});

	it('should finish successfully in case of GET request', async () => {
		const { id } = await got.post('http://localhost:80/v1/measurements', { json: {
			target: 'www.jsdelivr.com',
			type: 'http',
			measurementOptions: {
				request: {
					method: 'GET',
				},
			},
		} }).json();

		const response = await waitMesurementFinish(id);

		expect(response.body.status).to.equal('finished');
		expect(response.body.results[0].result.status).to.equal('finished');
		expect(response.body.results[0].result.rawBody.length).to.be.above(0);
		expect(response).to.matchApiSchema();
	});

	it('should return 400 for blacklisted target', async () => {
		const response = await got.post('http://localhost:80/v1/measurements', { json: {
			target: 'dpd.96594345154.xyz',
			type: 'http',
		}, throwHttpErrors: false });

		expect(response.statusCode).to.equal(400);
	});

	it('should return 400 for blacklisted request host', async () => {
		const response = await got.post('http://localhost:80/v1/measurements', { json: {
			target: 'www.jsdelivr.com',
			type: 'http',
			measurementOptions: {
				request: {
					host: 'dpd.96594345154.xyz',
				},
			},
		}, throwHttpErrors: false });

		expect(response.statusCode).to.equal(400);
	});

	it('should return 400 for blacklisted resolver', async () => {
		const response = await got.post('http://localhost:80/v1/measurements', { json: {
			target: 'www.jsdelivr.com',
			type: 'http',
			measurementOptions: {
				resolver: '113.24.166.134',
			},
		}, throwHttpErrors: false });

		expect(response.statusCode).to.equal(400);
	});
});
