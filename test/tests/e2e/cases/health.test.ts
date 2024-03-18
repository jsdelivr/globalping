import got from 'got';
import { expect } from 'chai';

describe('/probes endpoint', () => {
	it('should return an array of probes', async () => {
		const response = await got('http://localhost:80/health');

		expect(response.statusCode).to.equal(200);
		expect(response.body).to.equal('Alive');
	});
});
