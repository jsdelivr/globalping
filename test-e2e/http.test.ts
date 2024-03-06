import got from 'got';
import { expect } from 'chai';
import { waitMesurementFinish } from './utils.js';

describe('http mesurement', () => {
	it('should finish successfully', async () => {
		const { id } = await got.post('http://localhost:3000/v1/measurements', { json: {
			target: 'jsdelivr.com',
			type: 'http',
		} }).json();

		const { response, body } = await waitMesurementFinish(id);

		expect(body.status).to.equal('finished');
		expect(body.results[0].result.status).to.equal('finished');
		expect(response).to.matchApiSchema();
	});
});
