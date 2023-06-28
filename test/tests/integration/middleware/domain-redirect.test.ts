import type { Server } from 'node:http';
import request, { Response } from 'supertest';
import { expect } from 'chai';

import { getTestServer } from '../../../utils/server.js';

describe('domain redirect', () => {
	let app: Server;
	let requestAgent: any;

	before(async () => {
		app = await getTestServer();
		requestAgent = request(app);
	});

	describe('http requests', () => {
		it('should be redirected to "https://jsdelivr.com/globalping" if Host is "globalping.io"', async () => {
			await requestAgent
				.get('/v1/probes')
				.send()
				.set('Host', 'globalping.io')
				.expect(301)
				.expect((response: Response) => {
					expect(response.header.location).to.equal('https://jsdelivr.com/globalping');
				});
		});

		it('should not be redirected to if Host is not "globalping.io"', async () => {
			await requestAgent
				.get('/v1/probes')
				.send()
				.set('Host', 'api.globalping.io')
				.expect(200)
				.expect((response: Response) => {
					expect(response.body).to.deep.equal([]);
				});
		});
	});
});
