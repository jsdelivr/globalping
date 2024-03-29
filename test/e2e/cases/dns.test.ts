import got from 'got';
import { expect } from 'chai';
import { waitMesurementFinish } from '../utils.js';

describe('dns mesurement', () => {
	it('should finish successfully', async () => {
		const { id } = await got.post('http://localhost:80/v1/measurements', { json: {
			target: 'www.jsdelivr.com',
			type: 'dns',
		} }).json();

		const response = await waitMesurementFinish(id);

		expect(response.body.status).to.equal('finished');
		expect(response.body.results[0].result.status).to.equal('finished');
		expect(response.body.results[0].result.hops).to.not.exist;
		expect(response).to.matchApiSchema();
	});

	it('should finish successfully in case of "traced": true', async () => {
		const { id } = await got.post('http://localhost:80/v1/measurements', { json: {
			target: 'www.jsdelivr.com',
			type: 'dns',
			measurementOptions: {
				trace: true,
			},
		} }).json();

		const response = await waitMesurementFinish(id);

		expect(response.body.status).to.equal('finished');
		expect(response.body.results[0].result.status).to.equal('finished');
		expect(response.body.results[0].result.hops.length).to.be.above(0);
		expect(response).to.matchApiSchema();
	});

	it('should return 400 for blacklisted target', async () => {
		const response = await got.post('http://localhost:80/v1/measurements', { json: {
			target: 'dpd.96594345154.xyz',
			type: 'dns',
		}, throwHttpErrors: false });

		expect(response.statusCode).to.equal(400);
	});

	it('should return 400 for blacklisted resolver', async () => {
		const response = await got.post('http://localhost:80/v1/measurements', { json: {
			target: 'www.jsdelivr.com',
			type: 'dns',
			measurementOptions: {
				resolver: '113.24.166.134',
			},
		}, throwHttpErrors: false });

		expect(response.statusCode).to.equal(400);
	});

	it('should finish successfully in case of root domain target', async () => {
		const { id } = await got.post('http://localhost:80/v1/measurements', { json: {
			target: '.',
			type: 'dns',
			measurementOptions: {
				query: {
					type: 'ANY',
				},
			},
		} }).json();

		const response = await waitMesurementFinish(id);

		expect(response.body.status).to.equal('finished');
		expect(response.body.results[0].result.status).to.equal('finished');
		expect(response).to.matchApiSchema();
	});

	it('should finish successfully in case of tld target', async () => {
		const { id } = await got.post('http://localhost:80/v1/measurements', { json: {
			target: '.com',
			type: 'dns',
			measurementOptions: {
				query: {
					type: 'ANY',
				},
			},
		} }).json();

		const response = await waitMesurementFinish(id);

		expect(response.body.status).to.equal('finished');
		expect(response.body.results[0].result.status).to.equal('finished');
		expect(response).to.matchApiSchema();
	});
});
