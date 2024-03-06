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
		const responseOfCreate = await got.post('http://localhost:3000/v1/measurements', { json: {
			target: 'jsdelivr.com',
			type: 'ping',
		} });

		const { id } = JSON.parse(responseOfCreate.body);
		const responseOfRead = await got(`http://localhost:3000/v1/measurements/${id}`);
		const body = JSON.parse(responseOfRead.body);

		expect(body.probesCount).to.equal(1);
		expect(responseOfRead.statusCode).to.equal(200);
		expect(responseOfRead).to.matchApiSchema();
	});
});
