import type {Server} from 'node:http';
import request, {Response} from 'supertest';
import {expect} from 'chai';

import {getOrInitTestServer} from '../utils/http.js';

describe('CORS', () => {
	let app: Server;
	let requestAgent: any;

	before(async function () {
		this.timeout(5000);
		app = await getOrInitTestServer();
		requestAgent = request(app);
	});

	describe('Access-Control-Allow-Origin header', () => {
		it('should include the header', async () => {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-call
			const response = await requestAgent.get('/').set('Origin', 'elocast.com').send() as Response;

			expect(response.headers['access-control-allow-origin']).to.equal('elocast.com');
		});

		it('should NOT include the header', async () => {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-call
			const response = await requestAgent.get('/').send() as Response;

			expect(response.headers['access-control-allow-origin']).to.not.exist;
		});
	});
});
