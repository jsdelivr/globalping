import got from 'got';
import { expect } from 'chai';
import { waitMesurementFinish } from '../utils.js';

describe('ping mesurement', () => {
	it('should finish successfully', async () => {
		const { id } = await got.post('http://localhost:80/v1/measurements', { json: {
			target: 'www.jsdelivr.com',
			type: 'ping',
		} }).json();

		const response = await waitMesurementFinish(id);

		expect(response.body.status).to.equal('finished');
		expect(response.body.results[0].result.status).to.equal('finished');
		expect(response).to.matchApiSchema();
	});

	it('should return 400 for blacklisted target', async () => {
		const response = await got.post('http://localhost:80/v1/measurements', { json: {
			target: 'dpd.96594345154.xyz',
			type: 'ping',
		}, throwHttpErrors: false });

		expect(response.statusCode).to.equal(400);
	});
});
