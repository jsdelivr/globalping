import got from 'got';
import { expect } from 'chai';
import supertest from 'supertest';

const gotResponseToSupertestResponse = (gotResponse) => {
	const supertestResponse = { ...gotResponse } as unknown as supertest.Response;
	supertestResponse.body = JSON.parse(gotResponse.body);
	supertestResponse.type = gotResponse.headers['content-type'] === 'application/json; charset=utf-8' ? 'application/json' : gotResponse.headers['content-type'];
	return supertestResponse;
};

describe('/probes endpoint', () => {
	it('should return an array of probes', async () => {
		const gotResponse = await got('http://localhost:3000/v1/probes');
		const response = gotResponseToSupertestResponse(gotResponse);

		expect(response.statusCode).to.equal(200);
		expect(response.body.length).to.equal(1);
		expect(response).to.matchApiSchema();
	});
});
