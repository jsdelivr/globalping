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
	});

	describe('Access-Control-Allow-Headers header', () => {
		it('should include the header with value of *', async () => {
			const response = await requestAgent.get('/v1/').set('Origin', 'elocast.com').send() as Response;

			expect(response.headers['access-control-allow-headers']).to.equal('*');
		});

		it('should include the header with value of *, Authorization', async () => {
			const response = await requestAgent.options('/v1/measurements').send() as Response;

			expect(response.headers['access-control-allow-headers']).to.equal('*, Authorization');
		});
	});
});
