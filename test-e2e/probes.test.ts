import got from 'got';
import { expect } from 'chai';

describe('/probes endpoint', () => {
	it('should return an array of probes', async () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const response = await got('http://127.0.0.1:3000/v1/probes') as any;
		response.body = JSON.parse(response.body);
		response.type = response.headers['content-type'] === 'application/json; charset=utf-8' ? 'application/json' : response.headers['content-type'];

		expect(response.body.length).to.equal(1);
		expect(response).to.matchApiSchema();
	});
});
