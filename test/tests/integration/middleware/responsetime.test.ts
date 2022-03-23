import type {Server} from 'node:http';
import request, {Response} from 'supertest';
import {expect} from 'chai';

import {getTestServer} from '../../../utils/http.js';

describe('response time', () => {
	let app: Server;
	let requestAgent: any;

	before(async function () {
		this.timeout(15_000);
		app = await getTestServer();
		requestAgent = request(app);
	});

	describe('X-Response-Time header', () => {
		describe('should include the header', (): void => {
			it('should succeed', async () => {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-call
				const response = await requestAgent.get('/').send() as Response;

				expect(response.headers['x-response-time']).to.exist;
			});
		});
	});
});
