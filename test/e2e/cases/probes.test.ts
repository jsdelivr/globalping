import got from 'got';
import { expect } from 'chai';

describe('/probes endpoint', () => {
	it('should return an array of probes', async () => {
		const response = await got<any>('http://localhost:80/v1/probes', { responseType: 'json' });

		expect(response.statusCode).to.equal(200);
		expect(response.body.length).to.equal(1);
		expect(response).to.matchApiSchema();
	});
});
