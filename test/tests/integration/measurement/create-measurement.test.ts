
import fs from 'node:fs';
import {expect} from 'chai';
import request, {type SuperTest, type Test} from 'supertest';
import * as td from 'testdouble';
import nock from 'nock';
import {type Socket} from 'socket.io-client';
import RedisCacheMock from '../../../mocks/redis-cache.js';

const nockMocks = JSON.parse(fs.readFileSync('./test/mocks/nock-geoip.json').toString()) as Record<string, any>;

describe('Create measurement', function () {
	this.timeout(15_000);

	let addFakeProbe: () => Promise<Socket>;
	let deleteFakeProbe: (Socket) => Promise<void>;
	let getTestServer;
	let requestAgent: SuperTest<Test>;

	before(async () => {
		await td.replaceEsm('../../../../src/lib/cache/redis-cache.ts', {}, RedisCacheMock);
		await td.replaceEsm('../../../../src/lib/ip-ranges.ts', {getRegion: () => 'gcp-us-west4', populateMemList: () => Promise.resolve()});
		({getTestServer, addFakeProbe, deleteFakeProbe} = await import('../../../utils/server.js'));
		const app = await getTestServer();
		requestAgent = request(app);
	});

	after(() => {
		td.reset();
	});

	describe('probes not connected', () => {
		it('should respond with error', async () => {
			await requestAgent.post('/v1/measurements')
				.send({
					type: 'ping',
					target: 'example.com',
					locations: [{country: 'US'}],
					measurementOptions: {
						packets: 4,
					},
					limit: 2,
				})
				.expect(422)
				.expect(response => {
					expect(response.body).to.deep.equal({
						error: {
							message: 'No suitable probes found',
							type: 'no_probes_found',
						},
					});
				});
		});
	});

	let probe: Socket;

	describe('probes connected', () => {
		before(async () => {
			nock('https://globalping-geoip.global.ssl.fastly.net').get(/.*/).reply(200, nockMocks['01.00'].fastly);
			nock('https://ipinfo.io').get(/.*/).reply(200, nockMocks['01.00'].ipinfo);
			nock('https://geoip.maxmind.com/geoip/v2.1/city/').get(/.*/).reply(200, nockMocks['01.00'].maxmind);
			probe = await addFakeProbe();
		});

		after(async () => {
			await deleteFakeProbe(probe);
			nock.cleanAll();
		});

		it('should respond with error if there are no ready probes', async () => {
			await requestAgent.post('/v1/measurements')
				.send({
					type: 'ping',
					target: 'example.com',
					locations: [{country: 'US'}],
					measurementOptions: {
						packets: 4,
					},
					limit: 2,
				})
				.expect(422)
				.expect(response => {
					expect(response.body).to.deep.equal({
						error: {
							message: 'No suitable probes found',
							type: 'no_probes_found',
						},
					});
				});
		});

		it('should respond with error if probe emitted non-"ready" "probe:status:update"', async () => {
			probe.emit('probe:status:update', 'sigterm');
			await requestAgent.post('/v1/measurements')
				.send({
					type: 'ping',
					target: 'example.com',
					locations: [{country: 'US'}],
					measurementOptions: {
						packets: 4,
					},
					limit: 2,
				})
				.expect(422)
				.expect(response => {
					expect(response.body).to.deep.equal({
						error: {
							message: 'No suitable probes found',
							type: 'no_probes_found',
						},
					});
				});
		});

		it('should respond with error if probe emitted non-"ready" "probe:status:update" after being "ready"', async () => {
			probe.emit('probe:status:update', 'ready');
			probe.emit('probe:status:update', 'sigterm');
			await requestAgent.post('/v1/measurements')
				.send({
					type: 'ping',
					target: 'example.com',
					locations: [{country: 'US'}],
					measurementOptions: {
						packets: 4,
					},
					limit: 2,
				})
				.expect(422)
				.expect(response => {
					expect(response.body).to.deep.equal({
						error: {
							message: 'No suitable probes found',
							type: 'no_probes_found',
						},
					});
				});
		});

		it('should create measurement with global limit', async () => {
			probe.emit('probe:status:update', 'ready');
			await requestAgent.post('/v1/measurements')
				.send({
					type: 'ping',
					target: 'example.com',
					locations: [{country: 'US'}],
					measurementOptions: {
						packets: 4,
					},
					limit: 2,
				})
				.expect(202)
				.expect(({body, header}) => {
					expect(body.id).to.exist;
					expect(header.location).to.exist;
					expect(body.probesCount).to.equal(1);
				});
		});

		it('should create measurement with location limit', async () => {
			probe.emit('probe:status:update', 'ready');
			await requestAgent.post('/v1/measurements')
				.send({
					type: 'ping',
					target: 'example.com',
					locations: [{country: 'US', limit: 2}],
					measurementOptions: {
						packets: 4,
					},
				})
				.expect(202)
				.expect(({body, header}) => {
					expect(body.id).to.exist;
					expect(header.location).to.exist;
					expect(body.probesCount).to.equal(1);
				});
		});

		it('should create measurement for globally distributed probes', async () => {
			probe.emit('probe:status:update', 'ready');
			await requestAgent.post('/v1/measurements')
				.send({
					type: 'ping',
					target: 'example.com',
					measurementOptions: {
						packets: 4,
					},
					limit: 2,
				})
				.expect(202)
				.expect(({body, header}) => {
					expect(body.id).to.exist;
					expect(header.location).to.exist;
					expect(body.probesCount).to.equal(1);
				});
		});

		it('should create measurement with "magic: world" location', async () => {
			probe.emit('probe:status:update', 'ready');
			await requestAgent.post('/v1/measurements')
				.send({
					type: 'ping',
					target: 'example.com',
					locations: [{magic: 'world', limit: 2}],
					measurementOptions: {
						packets: 4,
					},
				})
				.expect(202)
				.expect(({body, header}) => {
					expect(body.id).to.exist;
					expect(header.location).to.exist;
					expect(body.probesCount).to.equal(1);
				});
		});

		it('should create measurement with "magic" value in any case', async () => {
			probe.emit('probe:status:update', 'ready');
			await requestAgent.post('/v1/measurements')
				.send({
					type: 'ping',
					target: 'example.com',
					locations: [{magic: 'Na'}],
					measurementOptions: {
						packets: 4,
					},
				})
				.expect(202)
				.expect(({body, header}) => {
					expect(body.id).to.exist;
					expect(header.location).to.exist;
					expect(body.probesCount).to.equal(1);
				});
		});

		it('should create measurement with partial tag value "magic: TaG-v" location', async () => {
			probe.emit('probe:status:update', 'ready');
			await requestAgent.post('/v1/measurements')
				.send({
					type: 'ping',
					target: 'example.com',
					locations: [{magic: 'Us-WeSt4', limit: 2}],
					measurementOptions: {
						packets: 4,
					},
				})
				.expect(202)
				.expect(({body, header}) => {
					expect(body.id).to.exist;
					expect(header.location).to.exist;
					expect(body.probesCount).to.equal(1);
				});
		});

		it('should not create measurement with "magic: non-existing-tag" location', async () => {
			probe.emit('probe:status:update', 'ready');
			await requestAgent.post('/v1/measurements')
				.send({
					type: 'ping',
					target: 'example.com',
					locations: [{magic: 'non-existing-tag', limit: 2}],
					measurementOptions: {
						packets: 4,
					},
				})
				.expect(422)
				.expect(response => {
					expect(response.body).to.deep.equal({
						error: {
							message: 'No suitable probes found',
							type: 'no_probes_found',
						},
					});
				});
		});

		it('should create measurement with "tags: ["tag-value"]" location', async () => {
			probe.emit('probe:status:update', 'ready');
			await requestAgent.post('/v1/measurements')
				.send({
					type: 'ping',
					target: 'example.com',
					locations: [{tags: ['gcp-us-west4'], limit: 2}],
					measurementOptions: {
						packets: 4,
					},
				})
				.expect(202)
				.expect(({body, header}) => {
					expect(body.id).to.exist;
					expect(header.location).to.exist;
					expect(body.probesCount).to.equal(1);
				});
		});
	});
});
