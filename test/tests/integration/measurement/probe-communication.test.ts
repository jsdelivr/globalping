import { setTimeout } from 'timers/promises';
import request, { type Agent } from 'supertest';
import * as td from 'testdouble';
import nock from 'nock';
import type { Socket } from 'socket.io-client';
import * as sinon from 'sinon';
import { expect } from 'chai';
import nockGeoIpProviders from '../../../utils/nock-geo-ip.js';
import { waitForProbesUpdate } from '../../../utils/server.js';

describe('Create measurement request', () => {
	let probe: Socket;
	let addFakeProbe: (events?: Record<string, any>) => Promise<Socket>;
	let deleteFakeProbes: () => Promise<void>;
	let getTestServer;
	let requestAgent: Agent;

	const sandbox = sinon.createSandbox();
	const locationHandlerStub = sandbox.stub();
	const requestHandlerStub = sandbox.stub();
	const cryptoRandomString = sandbox.stub().returns('measurementid');

	before(async () => {
		await td.replaceEsm('crypto-random-string', {}, cryptoRandomString);
		await td.replaceEsm('../../../../src/lib/ip-ranges.ts', { getRegion: () => 'gcp-us-west4', populateMemList: () => Promise.resolve() });
		({ getTestServer, addFakeProbe, deleteFakeProbes } = await import('../../../utils/server.js'));
		const app = await getTestServer();
		requestAgent = request(app);
	});

	beforeEach(async () => {
		sandbox.resetHistory();
		nockGeoIpProviders();

		probe = await addFakeProbe({
			'api:connect:location': locationHandlerStub,
			'probe:measurement:request': requestHandlerStub,
		});
	});

	afterEach(async () => {
		await deleteFakeProbes();
		nock.cleanAll();
	});

	after(() => {
		td.reset();
	});

	it('should send and handle proper events during probe connection', async () => {
		probe.emit('probe:dns:update', [ '1.1.1.1' ]);
		await waitForProbesUpdate();

		await requestAgent.post('/v1/measurements').send({
			type: 'ping',
			target: 'jsdelivr.com',
			locations: [{ country: 'US' }],
			measurementOptions: {
				packets: 4,
			},
		}).expect(422);

		expect(locationHandlerStub.callCount).to.equal(1);

		expect(locationHandlerStub.firstCall.args).to.deep.equal([{
			continent: 'NA',
			region: 'Northern America',
			country: 'US',
			state: 'TX',
			city: 'Dallas',
			normalizedCity: 'dallas',
			asn: 20004,
			latitude: 32.78,
			longitude: -96.81,
			network: 'The Constant Company LLC',
			normalizedNetwork: 'the constant company llc',
		}]);
	});

	it('should send and handle proper events during measurement request', async () => {
		probe.emit('probe:status:update', 'ready');
		probe.emit('probe:isIPv4Supported:update', true);
		probe.emit('probe:isIPv6Supported:update', true);
		await waitForProbesUpdate();

		await requestAgent.post('/v1/measurements').send({
			type: 'ping',
			target: 'jsdelivr.com',
			locations: [{ country: 'US' }],
			measurementOptions: {
				packets: 4,
			},
		}).expect(202).expect((response) => {
			expect(response.body.id).to.exist;
			expect(response.header['location']).to.exist;
			expect(response.body.probesCount).to.equal(1);
			expect(response).to.matchApiSchema();
		});

		await setTimeout(20);
		expect(requestHandlerStub.callCount).to.equal(1);

		expect(requestHandlerStub.firstCall.args[0]).to.deep.equal({
			measurementId: 'measurementid',
			testId: '0',
			measurement: { packets: 4, ipVersion: 4, type: 'ping', target: 'jsdelivr.com', inProgressUpdates: false },
		});

		await requestAgent.get(`/v1/measurements/measurementid`).send()
			.expect(200).expect((response) => {
				expect(response.headers['content-type']).to.equal('application/json; charset=utf-8');

				expect(response.body).to.deep.include({
					id: 'measurementid',
					type: 'ping',
					status: 'in-progress',
					target: 'jsdelivr.com',
					probesCount: 1,
					locations: [{ country: 'US' }],
					measurementOptions: { packets: 4 },
					results: [
						{
							probe: {
								continent: 'NA',
								region: 'Northern America',
								country: 'US',
								state: 'TX',
								city: 'Dallas',
								asn: 20004,
								longitude: -96.81,
								latitude: 32.78,
								network: 'The Constant Company LLC',
								tags: [ 'gcp-us-west4', 'datacenter-network' ],
								resolvers: [],
							},
							result: {
								status: 'in-progress',
								rawOutput: '',
							},
						},
					],
				});

				expect(response).to.matchApiSchema();
			});

		probe.emit('probe:measurement:ack', null, () => {});

		probe.emit('probe:measurement:progress', {
			testId: '0',
			measurementId: 'measurementid',
			result: {
				rawOutput: 'abc',
			},
		});

		await requestAgent.get(`/v1/measurements/measurementid`).send()
			.expect(200).expect((response) => {
				expect(response.body).to.deep.include({
					id: 'measurementid',
					type: 'ping',
					status: 'in-progress',
					target: 'jsdelivr.com',
					probesCount: 1,
					locations: [{ country: 'US' }],
					measurementOptions: { packets: 4 },
					results: [
						{
							probe: {
								continent: 'NA',
								region: 'Northern America',
								country: 'US',
								state: 'TX',
								city: 'Dallas',
								asn: 20004,
								longitude: -96.81,
								latitude: 32.78,
								network: 'The Constant Company LLC',
								tags: [ 'gcp-us-west4', 'datacenter-network' ],
								resolvers: [],
							},
							result: { status: 'in-progress', rawOutput: 'abc' },
						},
					],
				});

				expect(response).to.matchApiSchema();
			});

		probe.emit('probe:measurement:progress', {
			testId: '0',
			measurementId: 'measurementid',
			result: {
				rawOutput: 'def',
			},
		});

		await requestAgent.get(`/v1/measurements/measurementid`).send()
			.expect(200).expect((response) => {
				expect(response.body).to.deep.include({
					id: 'measurementid',
					type: 'ping',
					status: 'in-progress',
					target: 'jsdelivr.com',
					probesCount: 1,
					locations: [{ country: 'US' }],
					measurementOptions: { packets: 4 },
					results: [
						{
							probe: {
								continent: 'NA',
								region: 'Northern America',
								country: 'US',
								state: 'TX',
								city: 'Dallas',
								asn: 20004,
								longitude: -96.81,
								latitude: 32.78,
								network: 'The Constant Company LLC',
								tags: [ 'gcp-us-west4', 'datacenter-network' ],
								resolvers: [],
							},
							result: { status: 'in-progress', rawOutput: 'abcdef' },
						},
					],
				});
			});

		probe.emit('probe:measurement:result', {
			testId: '0',
			measurementId: 'measurementid',
			result: {
				status: 'finished',
				rawOutput: 'abcdefhij',
				resolvedHostname: 'jsdelivr.com',
				resolvedAddress: '1.1.1.1',
				stats: {
					min: 1,
					avg: 1,
					max: 1,
					total: 4,
					rcv: 4,
					drop: 0,
					loss: 0,
				},
				timings: [],
			},
		});

		await setTimeout(100); // We need to wait until all redis writes finish

		await requestAgent.get(`/v1/measurements/measurementid`).send()
			.expect(200).expect((response) => {
				expect(response.body).to.deep.include({
					id: 'measurementid',
					type: 'ping',
					status: 'finished',
					target: 'jsdelivr.com',
					probesCount: 1,
					locations: [{ country: 'US' }],
					measurementOptions: { packets: 4 },
					results: [
						{
							probe: {
								continent: 'NA',
								region: 'Northern America',
								country: 'US',
								state: 'TX',
								city: 'Dallas',
								asn: 20004,
								longitude: -96.81,
								latitude: 32.78,
								network: 'The Constant Company LLC',
								tags: [ 'gcp-us-west4', 'datacenter-network' ],
								resolvers: [],
							},
							result: {
								status: 'finished',
								rawOutput: 'abcdefhij',
								resolvedHostname: 'jsdelivr.com',
								resolvedAddress: '1.1.1.1',
								stats: {
									min: 1,
									avg: 1,
									max: 1,
									total: 4,
									rcv: 4,
									drop: 0,
									loss: 0,
								},
								timings: [],
							},
						},
					],
				});

				expect(response).to.matchApiSchema();
			});
	});

	it('should handle stats event from probe', async () => {
		probe.emit('probe:stats:report', {
			jobs: {
				count: 0,
			},
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

		await waitForProbesUpdate();

		await requestAgent.get('/v1/probes?adminkey=admin').send()
			.expect(200).expect((response) => {
				expect(response.body[0]).to.deep.include({
					status: 'initializing',
					isIPv4Supported: false,
					isIPv6Supported: false,
					version: '0.14.0',
					nodeVersion: 'v18.17.0',
					uuid: '1-1-1-1-1',
					location: {
						continent: 'NA',
						region: 'Northern America',
						country: 'US',
						state: 'TX',
						city: 'Dallas',
						asn: 20004,
						latitude: 32.78,
						longitude: -96.81,
						network: 'The Constant Company LLC',
					},
					tags: [ 'gcp-us-west4', 'datacenter-network' ],
					resolvers: [],
					host: '',
					stats: {
						jobs: {
							count: 0,
						},
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

				expect(response).to.matchApiSchema();
			});
	});

	it('should handle isIPv4Supported and isIPv6Supported events from probe', async () => {
		probe.emit('probe:status:update', 'ready');
		probe.emit('probe:isIPv4Supported:update', true);
		probe.emit('probe:isIPv6Supported:update', true);

		await waitForProbesUpdate();

		await requestAgent.get('/v1/probes?adminkey=admin').send()
			.expect(200).expect((response) => {
				expect(response.body[0]).to.deep.include({
					status: 'ready',
					isIPv4Supported: true,
					isIPv6Supported: true,
					version: '0.14.0',
					nodeVersion: 'v18.17.0',
					uuid: '1-1-1-1-1',
					location: {
						continent: 'NA',
						region: 'Northern America',
						country: 'US',
						state: 'TX',
						city: 'Dallas',
						asn: 20004,
						latitude: 32.78,
						longitude: -96.81,
						network: 'The Constant Company LLC',
					},
					tags: [ 'gcp-us-west4', 'datacenter-network' ],
					resolvers: [],
					host: '',
					stats: {
						jobs: {
							count: 0,
						},
						cpu: {
							load: [],
						},
					},
				});

				expect(response).to.matchApiSchema();
			});


		probe.emit('probe:status:update', 'ready');
		probe.emit('probe:isIPv4Supported:update', true);
		probe.emit('probe:isIPv6Supported:update', false);

		await waitForProbesUpdate();

		await requestAgent.get('/v1/probes?adminkey=admin').send()
			.expect(200).expect((response) => {
				expect(response.body[0]).to.deep.include({
					status: 'ready',
					isIPv4Supported: true,
					isIPv6Supported: false,
					version: '0.14.0',
					nodeVersion: 'v18.17.0',
					uuid: '1-1-1-1-1',
					location: {
						continent: 'NA',
						region: 'Northern America',
						country: 'US',
						state: 'TX',
						city: 'Dallas',
						asn: 20004,
						latitude: 32.78,
						longitude: -96.81,
						network: 'The Constant Company LLC',
					},
					tags: [ 'gcp-us-west4', 'datacenter-network' ],
					resolvers: [],
					host: '',
					stats: {
						jobs: {
							count: 0,
						},
						cpu: {
							load: [],
						},
					},
				});

				expect(response).to.matchApiSchema();
			});


		probe.emit('probe:status:update', 'ready');
		probe.emit('probe:isIPv4Supported:update', false);
		probe.emit('probe:isIPv6Supported:update', true);

		await waitForProbesUpdate();

		await requestAgent.get('/v1/probes?adminkey=admin').send()
			.expect(200).expect((response) => {
				expect(response.body[0]).to.deep.include({
					status: 'ready',
					isIPv4Supported: false,
					isIPv6Supported: true,
					version: '0.14.0',
					nodeVersion: 'v18.17.0',
					uuid: '1-1-1-1-1',
					location: {
						continent: 'NA',
						region: 'Northern America',
						country: 'US',
						state: 'TX',
						city: 'Dallas',
						asn: 20004,
						latitude: 32.78,
						longitude: -96.81,
						network: 'The Constant Company LLC',
					},
					tags: [ 'gcp-us-west4', 'datacenter-network' ],
					resolvers: [],
					host: '',
					stats: {
						jobs: {
							count: 0,
						},
						cpu: {
							load: [],
						},
					},
				});

				expect(response).to.matchApiSchema();
			});


		probe.emit('probe:status:update', 'ping-test-failed');
		probe.emit('probe:isIPv4Supported:update', false);
		probe.emit('probe:isIPv6Supported:update', false);

		await waitForProbesUpdate();

		await requestAgent.get('/v1/probes?adminkey=admin').send()
			.expect(200).expect((response) => {
				expect(response.body[0]).to.deep.include({
					status: 'ping-test-failed',
					isIPv4Supported: false,
					isIPv6Supported: false,
					version: '0.14.0',
					nodeVersion: 'v18.17.0',
					uuid: '1-1-1-1-1',
					location: {
						continent: 'NA',
						region: 'Northern America',
						country: 'US',
						state: 'TX',
						city: 'Dallas',
						asn: 20004,
						latitude: 32.78,
						longitude: -96.81,
						network: 'The Constant Company LLC',
					},
					tags: [ 'gcp-us-west4', 'datacenter-network' ],
					resolvers: [],
					host: '',
					stats: {
						jobs: {
							count: 0,
						},
						cpu: {
							load: [],
						},
					},
				});

				expect(response).to.matchApiSchema();
			});
	});
});
