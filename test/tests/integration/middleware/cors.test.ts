import type {Server} from 'node:http';
import request, {Response} from 'supertest';
import {expect} from 'chai';

import {getTestServer} from '../../../utils/http.js';

describe('cors', () => {
	let app: Server;
	let requestAgent: any;

	before(async function () {
		this.timeout(15_000);
		app = await getTestServer();
		requestAgent = request(app);
	});

	describe('Access-Control-Allow-Origin header', () => {
		it('should include the header', async () => {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-call
			const response = await requestAgent.get('/v1/').set('Origin', 'elocast.com').send() as Response;

			expect(response.headers['access-control-allow-origin']).to.equal('elocast.com');
		});

		it('should NOT include the header', async () => {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-call
			const response = await requestAgent.get('/').send() as Response;

			expect(response.headers['access-control-allow-origin']).to.not.exist;
		});
	});
});
