import type { Server } from 'node:http';
import process from 'node:process';
import { expect } from 'chai';
import * as sinon from 'sinon';
import request, { type SuperTest, type Test } from 'supertest';
import { getTestServer } from '../../../utils/server.js';

after(() => {
	process.removeAllListeners('SIGTERM');
	process.removeAllListeners('SIGINT');
});

describe('Get health', function () {
	this.timeout(15_000);

	let app: Server;
	let requestAgent: SuperTest<Test>;
	let sandbox: sinon.SinonSandbox;
	let exitStub: sinon.SinonStub;

	before(async () => {
		app = await getTestServer();
		requestAgent = request(app);
	});

	beforeEach(() => {
		sandbox = sinon.createSandbox({ useFakeTimers: true });
		exitStub = sandbox.stub(process, 'exit');
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

		it('should respond with "Received SIGTERM, shutting down" message and exit in 15_000 ms after SIGTERM', async () => {
			process.once('SIGTERM', () => {
				sinon.assert.notCalled(exitStub);
				sandbox.clock.tick(15_000 + 10);
				sinon.assert.calledOnce(exitStub);
			});

			process.emit('SIGTERM');

			await requestAgent.get('/health')
				.send()
				.expect(200)
				.expect((response) => {
					expect(response.text).to.equal('Received SIGTERM, shutting down');
				});
		});
	});
});
