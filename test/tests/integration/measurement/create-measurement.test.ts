import type {Server} from 'node:http';
import {expect} from 'chai';
import request, {SuperTest, Test} from 'supertest';
import type {Socket as SocketClient} from 'socket.io-client';
import {getTestServer} from '../../../utils/http.js';
import {createFakeProbeServer} from '../../../mocks/probe.mock.js';

describe('Create measurement', function () {
	this.timeout(10_000);

	let app: Server;
	let requestAgent: SuperTest<Test>;

	before(async () => {
		app = await getTestServer();
		requestAgent = request(app);
	});

	describe('probes not connected', () => {
		it('should respond with error', async () => {
			await requestAgent.post('/v1/measurements')
				.send({
					locations: [{type: 'country', value: 'US'}],
					measurement: {
						type: 'ping',
						target: 'example.com',
						packets: 4,
					},
					limit: 2,
				})
				.expect(400)
				.expect(response => {
					expect(response.text).to.equal('no suitable probes');
				});
		});
	});

	describe('probes connected', () => {
		let fakeProbe: SocketClient;

		before(async () => {
			fakeProbe = await createFakeProbeServer();
		});

		after(() => {
			fakeProbe.disconnect();
		});

		it('should create measurement with global limit', async () => {
			await requestAgent.post('/v1/measurements')
				.send({
					locations: [{type: 'country', value: 'US'}],
					measurement: {
						type: 'ping',
						target: 'example.com',
						packets: 4,
					},
					limit: 2,
				})
				.expect(200)
				.expect(({body}) => {
					expect(body.id).to.exist;
					expect(body.probesCount).to.equal(1);
				});
		});

		it('should create measurement with location limit', async () => {
			await requestAgent.post('/v1/measurements')
				.send({
					locations: [{type: 'country', value: 'US', limit: 2}],
					measurement: {
						type: 'ping',
						target: 'example.com',
						packets: 4,
					},
				})
				.expect(200)
				.expect(({body}) => {
					expect(body.id).to.exist;
					expect(body.probesCount).to.equal(1);
				});
		});

		it('should create measurement for globally distributed probes', async () => {
			await requestAgent.post('/v1/measurements')
				.send({
					measurement: {
						type: 'ping',
						target: 'example.com',
						packets: 4,
					},
					limit: 2,
				})
				.expect(200)
				.expect(({body}) => {
					expect(body.id).to.exist;
					expect(body.probesCount).to.equal(1);
				});
		});
	});
});
