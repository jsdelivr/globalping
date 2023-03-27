import fs from 'node:fs';
import request, { type SuperTest, type Test } from 'supertest';
import * as td from 'testdouble';
import nock from 'nock';
import { type Socket } from 'socket.io-client';
import * as sinon from 'sinon';
import { expect } from 'chai';
import RedisCacheMock from '../../../mocks/redis-cache.js';

const nockMocks = JSON.parse(fs.readFileSync('./test/mocks/nock-geoip.json').toString()) as Record<string, any>;

describe('Create measurement request', function () {
	this.timeout(5000);

	let probe: Socket;
	let addFakeProbe: (events?: Record<string, any>) => Promise<Socket>;
	let deleteFakeProbe: (Socket) => Promise<void>;
	let getTestServer;
	let requestAgent: SuperTest<Test>;

	const locationHandlerStub = sinon.stub();
	const requestHandlerStub = sinon.stub();

	before(async () => {
		await td.replaceEsm('../../../../src/lib/cache/redis-cache.ts', {}, RedisCacheMock);
		await td.replaceEsm('../../../../src/lib/ip-ranges.ts', { getRegion: () => 'gcp-us-west4', populateMemList: () => Promise.resolve() });
		({ getTestServer, addFakeProbe, deleteFakeProbe } = await import('../../../utils/server.js'));
		const app = await getTestServer();
		requestAgent = request(app);
	});

	beforeEach(async () => {
		nock('https://globalping-geoip.global.ssl.fastly.net').get(/.*/).reply(200, nockMocks['01.00'].fastly);
		nock('https://ipinfo.io').get(/.*/).reply(200, nockMocks['01.00'].ipinfo);
		nock('https://geoip.maxmind.com/geoip/v2.1/city/').get(/.*/).reply(200, nockMocks['01.00'].maxmind);

		probe = await addFakeProbe({
			'api:connect:location': locationHandlerStub,
			'probe:measurement:request': requestHandlerStub,
		});
	});

	afterEach(async () => {
		await deleteFakeProbe(probe);
		nock.cleanAll();
	});

	after(() => {
		td.reset();
	});

	it('should send and handle proper events during probe connection', async () => {
		probe.emit('probe:status:update', 'ready');
		probe.emit('probe:dns:update', [ '1.1.1.1' ]);
		expect(locationHandlerStub.callCount).to.equal(1);

		expect(locationHandlerStub.firstCall.args).to.deep.equal([{
			continent: 'NA',
			region: 'Northern America',
			normalizedRegion: 'northern america',
			country: 'US',
			state: 'TX',
			city: 'Dallas',
			normalizedCity: 'dallas',
			asn: 123,
			latitude: 32.7492,
			longitude: -96.8389,
			network: 'Psychz Networks',
			normalizedNetwork: 'psychz networks',
		}]);
	});

	it('should send and handle proper events during measurement request', async () => {
		let measurementId!: string;

		probe.emit('probe:status:update', 'ready');

		await requestAgent.post('/v1/measurements').send({
			type: 'ping',
			target: 'jsdelivr.com',
			locations: [{ country: 'US' }],
			measurementOptions: {
				packets: 4,
			},
		}).expect(202).expect(({ body, header }) => {
			measurementId = body.id as string;
			expect(body.id).to.exist;
			expect(header.location).to.exist;
			expect(body.probesCount).to.equal(1);
		});

		expect(requestHandlerStub.callCount).to.equal(1);

		expect(requestHandlerStub.firstCall.args).to.deep.equal([{
			id: measurementId,
			measurement: { packets: 4, type: 'ping', target: 'jsdelivr.com' },
		}]);

		probe.emit('probe:measurement:ack', { id: 'testId', measurementId });

		await requestAgent.get(`/v1/measurements/${measurementId}`).send()
			.expect(200).expect((response) => {
				expect(response.body).to.deep.include({
					id: measurementId,
					type: 'ping',
					status: 'in-progress',
					probesCount: 1,
					results: [
						{
							probe: {
								continent: 'NA',
								region: 'Northern America',
								country: 'US',
								state: 'TX',
								city: 'Dallas',
								asn: 123,
								longitude: -96.8389,
								latitude: 32.7492,
								network: 'Psychz Networks',
								tags: [ 'gcp-us-west4' ],
								resolvers: [],
							},
							result: { status: 'in-progress', rawOutput: '' },
						},
					],
				});
			});

		probe.emit('probe:measurement:progress', {
			testId: 'testId',
			measurementId,
			result: {
				rawOutput: 'abc',
			},
		});

		await requestAgent.get(`/v1/measurements/${measurementId}`).send()
			.expect(200).expect((response) => {
				expect(response.body).to.deep.include({
					id: measurementId,
					type: 'ping',
					status: 'in-progress',
					probesCount: 1,
					results: [
						{
							probe: {
								continent: 'NA',
								region: 'Northern America',
								country: 'US',
								state: 'TX',
								city: 'Dallas',
								asn: 123,
								longitude: -96.8389,
								latitude: 32.7492,
								network: 'Psychz Networks',
								tags: [ 'gcp-us-west4' ],
								resolvers: [],
							},
							result: { status: 'in-progress', rawOutput: 'abc' },
						},
					],
				});
			});

		probe.emit('probe:measurement:progress', {
			testId: 'testId',
			measurementId,
			result: {
				rawOutput: 'def',
			},
		});

		await requestAgent.get(`/v1/measurements/${measurementId}`).send()
			.expect(200).expect((response) => {
				expect(response.body).to.deep.include({
					id: measurementId,
					type: 'ping',
					status: 'in-progress',
					probesCount: 1,
					results: [
						{
							probe: {
								continent: 'NA',
								region: 'Northern America',
								country: 'US',
								state: 'TX',
								city: 'Dallas',
								asn: 123,
								longitude: -96.8389,
								latitude: 32.7492,
								network: 'Psychz Networks',
								tags: [ 'gcp-us-west4' ],
								resolvers: [],
							},
							result: { status: 'in-progress', rawOutput: 'abcdef' },
						},
					],
				});
			});

		probe.emit('probe:measurement:result', {
			testId: 'testId',
			measurementId,
			result: {
				status: 'finished',
				rawOutput: 'abcdefhij',
				resolvedHostname: 'jsdelivr.com',
				resolvedAddress: '1.1.1.1',
			},
		});

		// eslint-disable-next-line no-promise-executor-return
		await new Promise(resolve => setTimeout(resolve, 100)); // We need to wait until all redis writes finish

		await requestAgent.get(`/v1/measurements/${measurementId}`).send()
			.expect(200).expect((response) => {
				expect(response.body).to.deep.include({
					id: measurementId,
					type: 'ping',
					status: 'finished',
					probesCount: 1,
					results: [
						{
							probe: {
								continent: 'NA',
								region: 'Northern America',
								country: 'US',
								state: 'TX',
								city: 'Dallas',
								asn: 123,
								longitude: -96.8389,
								latitude: 32.7492,
								network: 'Psychz Networks',
								tags: [ 'gcp-us-west4' ],
								resolvers: [],
							},
							result: {
								status: 'finished',
								rawOutput: 'abcdefhij',
								resolvedHostname: 'jsdelivr.com',
								resolvedAddress: '1.1.1.1',
							},
						},
					],
				});
			});
	});

	it('should handle stats event from probe', async () => {
		probe.emit('probe:stats:report', {
			cpu: {
				count: 4,
				load: [
					{
						usage: 1.02,
						idle: 98.98,
					},
					{
						usage: 6.32,
						idle: 93.68,
					},
					{
						usage: 2.06,
						idle: 97.94,
					},
					{
						usage: 43,
						idle: 57,
					},
				],
			},
		});

		await requestAgent.get('/v1/probes?adminkey=admin').send()
			.expect(200).expect((response) => {
				expect(response.body[0]).to.deep.include({
					version: '0.14.0',
					status: 'initializing',
					location: {
						continent: 'NA',
						region: 'Northern America',
						country: 'US',
						state: 'TX',
						city: 'Dallas',
						asn: 123,
						latitude: 32.7492,
						longitude: -96.8389,
						network: 'Psychz Networks',
					},
					tags: [ 'gcp-us-west4' ],
					resolvers: [],
					host: '',
					stats: {
						cpu: {
							count: 4,
							load: [
								{ usage: 1.02, idle: 98.98 },
								{ usage: 6.32, idle: 93.68 },
								{ usage: 2.06, idle: 97.94 },
								{ usage: 43, idle: 57 },
							],
						},
					},
				});
			});
	});
});
