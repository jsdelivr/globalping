import type { Server } from 'node:http';
import process from 'node:process';
import { expect } from 'chai';
import * as sinon from 'sinon';
import request, { type Agent } from 'supertest';
import { getTestServer } from '../../utils/server.js';

after(() => {
	process.removeAllListeners('SIGTERM');
	process.removeAllListeners('SIGINT');
});

describe('Get health', () => {
	let app: Server;
	let requestAgent: Agent;
	const sandbox = sinon.createSandbox();

	before(async () => {
		app = await getTestServer();
		requestAgent = request(app);
	});

	afterEach(() => {
		sandbox.restore();
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
