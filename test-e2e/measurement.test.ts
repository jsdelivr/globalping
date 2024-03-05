import got from 'got';
import { expect } from 'chai';

describe('/measurements endpoint', () => {
	it('should create measurement', async () => {
		const response = await got.post('http://localhost:3000/v1/measurements', { json: {
			target: 'jsdelivr.com',
			type: 'ping',
		} });

		expect(response.statusCode).to.equal(202);
		expect(response).to.matchApiSchema();
	});

	it('should return measurement result', async () => {
		const postResponse = await got.post('http://localhost:3000/v1/measurements', { json: {
			target: 'jsdelivr.com',
			type: 'ping',
		} });

		const { id } = JSON.parse(postResponse.body);
		const getResponse = await got(`http://localhost:3000/v1/measurements/${id}`);

		expect(getResponse.statusCode).to.equal(200);
		expect(getResponse).to.matchApiSchema();
	});
});
