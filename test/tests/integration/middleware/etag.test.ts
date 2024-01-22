import type { Server } from 'node:http';
import request, { type Response } from 'supertest';
import { expect } from 'chai';

import { getTestServer } from '../../../utils/server.js';

describe('etag', () => {
	let app: Server;
	let requestAgent: any;

	before(async () => {
		app = await getTestServer();
		requestAgent = request(app);
	});

	describe('ETag header', () => {
		it('should include the header', async () => {
			const response = await requestAgent.get('/v1/probes').send() as Response;

			expect(response.headers['etag']).to.exist;
		});
	});

	describe('conditional get', () => {
		it('should redirect to cache', async () => {
			const response = await requestAgent
				.get('/v1/probes')
				.set('if-none-match', 'W/"2-l9Fw4VUO7kr8CvBlt4zaMCqXZ0w"')
				.send() as Response;

			expect(response.status).to.equal(304);
		});
	});
});
