import got from 'got';
import { expect } from 'chai';

describe('/probes endpoint', () => {
	it('should return an array of probes', async () => {
		const response = await got('http://localhost:3000/v1/probes');
		const probes = JSON.parse(response.body);

		expect(response.statusCode).to.equal(200);
		expect(probes.length).to.equal(1);
		expect(response).to.matchApiSchema();
	});
});
