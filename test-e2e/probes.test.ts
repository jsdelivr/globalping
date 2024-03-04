import got from 'got';
import { expect } from 'chai';

import type { Probe } from '../src/probe/types.js';

describe('/probes endpoint', () => {
	it('should return an array of probes', async () => {
		const probes = await got('http://127.0.0.1:3000/v1/probes').json<Probe[]>();
		// const response = {
		// 	req: {
		// 		path: '/v1/probes',
		// 		method: 'GET',
		// 	},
		// 	statusCode: 200,
		// 	type: 'OK',
		// 	headers: {
		// 		'content-type': 'application/json',
		// 	},
		// 	body: probes,
		// };

		expect(probes.length).to.equal(1);
		// expect(response).to.matchApiSchema();
	});
});
