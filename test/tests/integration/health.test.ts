import type { Server } from 'node:http';
import { expect } from 'chai';
import request, { type Agent } from 'supertest';
import { getTestServer } from '../../utils/server.js';

describe('Get health', () => {
	let app: Server;
	let requestAgent: Agent;

	before(async () => {
		app = await getTestServer();
		requestAgent = request(app);
	});

	describe('health endpoint', () => {
		it('should respond with "Alive" message by default', async () => {
			await requestAgent.get('/health')
				.send()
				.expect(200)
				.expect((response) => {
					expect(response.text).to.equal('Alive');
				});
		});
	});
});
