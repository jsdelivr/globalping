/* eslint-disable no-unused-expressions */
import got from 'got';
import { expect } from 'chai';
import { waitMesurementFinish } from './utils.js';

describe('dns mesurement', () => {
	it('should finish successfully', async () => {
		const { id } = await got.post('http://localhost:3000/v1/measurements', { json: {
			target: 'jsdelivr.com',
			type: 'dns',
		} }).json();

		const { response, body } = await waitMesurementFinish(id);

		expect(body.status).to.equal('finished');
		expect(body.results[0].result.status).to.equal('finished');
		expect(body.results[0].result.hops).to.not.exist;
		expect(response).to.matchApiSchema();
	});

	it('should finish successfully in case of "traced": true', async () => {
		const { id } = await got.post('http://localhost:3000/v1/measurements', { json: {
			target: 'jsdelivr.com',
			type: 'dns',
			measurementOptions: {
				trace: true,
			},
		} }).json();

		const { response, body } = await waitMesurementFinish(id);

		expect(body.status).to.equal('finished');
		expect(body.results[0].result.status).to.equal('finished');
		expect(body.results[0].result.hops.length > 0).to.be.true;
		expect(response).to.matchApiSchema();
	});
});
