import type { Server } from 'node:http';
import request, { type Response } from 'supertest';
import { expect } from 'chai';

import { getTestServer } from '../../../utils/server.js';

describe('cors', () => {
	let app: Server;
	let requestAgent: any;

	before(async () => {
		app = await getTestServer();
		requestAgent = request(app);
	});

	describe('Access-Control-Allow-Origin header', () => {
		it('should include the header with value of *', async () => {
			const response = await requestAgent.get('/v1/').set('Origin', 'elocast.com').send() as Response;

			expect(response.headers['access-control-allow-origin']).to.equal('*');
		});

		it('should include the header at root', async () => {
			const response = await requestAgent.get('/').send() as Response;

			expect(response.headers['access-control-allow-origin']).to.equal('*');
		});

		describe('POST /v1/measurements', () => {
			it('should include the explicit origin if it is trusted', async () => {
				const response = await requestAgent.options('/v1/measurements').set('Origin', 'https://globalping.io').send() as Response;

				expect(response.headers['access-control-allow-origin']).to.equal('https://globalping.io');
				expect(response.headers['vary']).to.include('Origin');
			});

			it('should include the wildcard if the origin is not trusted', async () => {
				const response = await requestAgent.options('/v1/measurements').send() as Response;

				expect(response.headers['access-control-allow-origin']).to.equal('*');
			});
		});
	});

	describe('Access-Control-Allow-Headers header', () => {
		it('should include the header with value of *', async () => {
			const response = await requestAgent.get('/v1/').set('Origin', 'elocast.com').send() as Response;

			expect(response.headers['access-control-allow-headers']).to.equal('*');
		});

		it('should include the header with value of Authorization, Content-Type', async () => {
			const response = await requestAgent.options('/v1/measurements').send() as Response;

			expect(response.headers['access-control-allow-headers']).to.equal('Authorization, Content-Type');
		});
	});
});
