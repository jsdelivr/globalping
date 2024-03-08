import got from 'got';
import { expect } from 'chai';
import { waitMesurementFinish } from '../utils.js';

describe('ping mesurement', () => {
	it('should finish successfully', async () => {
		const { id } = await got.post('http://localhost:80/v1/measurements', { json: {
			target: 'www.jsdelivr.com',
			type: 'ping',
		} }).json();

		const { response, body } = await waitMesurementFinish(id);

		expect(body.status).to.equal('finished');
		expect(body.results[0].result.status).to.equal('finished');
		expect(response).to.matchApiSchema();
	});
});
