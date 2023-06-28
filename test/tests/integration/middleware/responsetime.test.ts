import type { Server } from 'node:http';
import request, { type Response } from 'supertest';
import { expect } from 'chai';

import { getTestServer } from '../../../utils/server.js';

describe('response time', () => {
	let app: Server;
	let requestAgent: any;

	before(async () => {
		app = await getTestServer();
		requestAgent = request(app);
	});

	describe('X-Response-Time header', () => {
		describe('should include the header', (): void => {
			it('should succeed', async () => {
				const response = await requestAgent.get('/v1/').send() as Response;

				expect(response.headers['x-response-time']).to.exist;
			});
		});
	});
});
