import type { Server } from 'node:http';
import request, { type Response } from 'supertest';
import { expect } from 'chai';

import { getTestServer } from '../../../utils/server.js';

describe('static asset cache headers', () => {
	let app: Server;
	let requestAgent: any;

	before(async () => {
		app = await getTestServer();
		requestAgent = request(app);
	});

	it('should expose the configured cache policy for public assets', async () => {
		await requestAgent
			.get('/demo/index.html')
			.expect(200)
			.expect((response: Response) => {
				expect(response.headers['cache-control']).to.equal('public, max-age=60, stale-while-revalidate=60, stale-if-error=86400');
			});
	});
});
