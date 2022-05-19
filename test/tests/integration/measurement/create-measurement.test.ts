import type {Server} from 'node:http';
import {expect} from 'chai';
import request, {SuperTest, Test} from 'supertest';
import {getTestServer} from '../../../utils/http.js';
import {addFakeProbe, deleteFakeProbe} from '../../../utils/ws.js';

describe('Create measurement', function () {
	this.timeout(5000);

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
					expect(response.body).to.deep.equal({
						error: {
							message: 'No suitable probes found',
							type: 'api_error',
						},
					});
				});
		});
	});

	describe('probes connected', () => {
		before(async () => {
			await addFakeProbe('fake-probe-US', {location: {continent: 'NA', country: 'US'}});
		});

		after(() => {
			deleteFakeProbe('fake-probe-US');
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

		it('should create measurement with "magic: world" location', async () => {
			await requestAgent.post('/v1/measurements')
				.send({
					locations: [{type: 'magic', value: 'world', limit: 2}],
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
	});
});
