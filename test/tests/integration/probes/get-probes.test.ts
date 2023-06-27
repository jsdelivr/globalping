/* eslint-disable @typescript-eslint/no-unused-vars */
import fs from 'node:fs';
import nock from 'nock';
import { expect } from 'chai';
import request, { type SuperTest, type Test } from 'supertest';
import * as td from 'testdouble';
import type { Socket } from 'socket.io-client';
import { getTestServer, addFakeProbe as addProbe, deleteFakeProbe } from '../../../utils/server.js';
import nockGeoIpProviders from '../../../utils/nock-geo-ip.js';

describe('Get Probes', () => {
	let requestAgent: SuperTest<Test>;
	let addFakeProbe: () => Promise<Socket>;
	const probes: Socket[] = [];

	before(async () => {
		addFakeProbe = async () => {
			const probe = await addProbe();
			probes.push(probe);
			return probe;
		};

		const app = await getTestServer();
		requestAgent = request(app);
	});

	afterEach(async () => {
		nock.cleanAll();
		await Promise.all(probes.map(probe => deleteFakeProbe(probe)));
	});

	after(() => {
		td.reset();
	});

	describe('probes not connected', () => {
		it('should respond with an empty array', async () => {
			await requestAgent.get('/v1/probes')
				.send()
				.expect(200)
				.expect((response) => {
					expect(response.body).to.deep.equal([]);
					expect(response).to.matchApiSchema();
				});
		});
	});

	describe('probes connected', () => {
		it('should not detect probes if they are not ready', async () => {
			nockGeoIpProviders();

			await addFakeProbe();

			await requestAgent.get('/v1/probes')
				.send()
				.expect(200)
				.expect((response) => {
					expect(response.body).to.deep.equal([]);
				});
		});

		it('should detect 1 probe in "ready: true" status', async () => {
			nockGeoIpProviders({ maxmind: 'argentina', ipinfo: 'argentina', fastly: 'argentina' });

			const probe = await addFakeProbe();
			probe.emit('probe:status:update', 'ready');

			await requestAgent.get('/v1/probes')
				.send()
				.expect(200)
				.expect((response) => {
					expect(response.body).to.deep.equal([{
						version: '0.14.0',
						location: {
							continent: 'SA',
							region: 'South America',
							country: 'AR',
							city: 'Buenos Aires',
							asn: 61_493,
							latitude: -34.602,
							longitude: -58.384,
							network: 'interbs s.r.l.',
						},
						tags: [],
						resolvers: [],
					}]);
				});
		});

		it('should detect 2 probes in "ready: true" status', async () => {
			nockGeoIpProviders({ maxmind: 'argentina', ipinfo: 'argentina', fastly: 'argentina' });
			nockGeoIpProviders();

			const probe1 = await addFakeProbe();
			const probe2 = await addFakeProbe();
			probe1.emit('probe:status:update', 'ready');
			probe2.emit('probe:status:update', 'ready');

			await requestAgent.get('/v1/probes')
				.send()
				.expect(200)
				.expect((response) => {
					expect(response.body).to.deep.equal([{
						version: '0.14.0',
						location: {
							continent: 'SA',
							region: 'South America',
							country: 'AR',
							city: 'Buenos Aires',
							asn: 61_493,
							latitude: -34.602,
							longitude: -58.384,
							network: 'interbs s.r.l.',
						},
						tags: [],
						resolvers: [],
					},
					{
						version: '0.14.0',
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
						tags: [],
						resolvers: [],
					}]);
				});
		});

		it('should detect 3 probes in "ready: true" status', async () => {
			nockGeoIpProviders({ maxmind: 'argentina', ipinfo: 'argentina', fastly: 'argentina' });
			nockGeoIpProviders();
			nockGeoIpProviders({ maxmind: 'newYork', ipinfo: 'newYork', fastly: 'newYork' });

			const probe1 = await addFakeProbe();
			const probe2 = await addFakeProbe();
			const probe3 = await addFakeProbe();
			probe1.emit('probe:status:update', 'ready');
			probe2.emit('probe:status:update', 'ready');
			probe3.emit('probe:status:update', 'ready');

			await requestAgent.get('/v1/probes')
				.send()
				.expect(200)
				.expect((response) => {
					expect(response.body).to.deep.equal([
						{
							version: '0.14.0',
							location: {
								continent: 'SA',
								region: 'South America',
								country: 'AR',
								city: 'Buenos Aires',
								asn: 61_493,
								latitude: -34.602,
								longitude: -58.384,
								network: 'interbs s.r.l.',
							},
							tags: [],
							resolvers: [],
						},
						{
							version: '0.14.0',
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
							tags: [],
							resolvers: [],
						},
						{
							version: '0.14.0',
							location: {
								continent: 'NA',
								region: 'Northern America',
								country: 'US',
								state: 'NY',
								city: 'New York',
								asn: 61_493,
								latitude: -7.7568,
								longitude: -35.3656,
								network: 'InterBS S.R.L. (BAEHOST)',
							},
							tags: [],
							resolvers: [],
						},
					]);
				});
		});

		it('should detect only "ready" probes and filter out other', async () => {
			nockGeoIpProviders({ maxmind: 'argentina', ipinfo: 'argentina', fastly: 'argentina' });
			nockGeoIpProviders();

			const probe1 = await addFakeProbe();
			await addFakeProbe();
			probe1.emit('probe:status:update', 'ready');

			await requestAgent.get('/v1/probes')
				.send()
				.expect(200)
				.expect((response) => {
					expect(response.body).to.deep.equal([{
						version: '0.14.0',
						location: {
							continent: 'SA',
							region: 'South America',
							country: 'AR',
							city: 'Buenos Aires',
							asn: 61_493,
							latitude: -34.602,
							longitude: -58.384,
							network: 'interbs s.r.l.',
						},
						tags: [],
						resolvers: [],
					}]);
				});
		});

		it('should add extra info if admin key is provided', async () => {
			nockGeoIpProviders({ maxmind: 'argentina', ipinfo: 'argentina', fastly: 'argentina' });

			const probe = await addFakeProbe();
			probe.emit('probe:status:update', 'ready');

			await requestAgent.get('/v1/probes?adminkey=admin')
				.send()
				.expect(200)
				.expect((response) => {
					expect(response.body[0]).to.deep.include({
						version: '0.14.0',
						host: '',
						location: {
							continent: 'SA',
							region: 'South America',
							country: 'AR',
							city: 'Buenos Aires',
							asn: 61_493,
							latitude: -34.602,
							longitude: -58.384,
							network: 'interbs s.r.l.',
						},
						stats: { cpu: { count: 0, load: [] }, jobs: { count: 0 } },
						status: 'ready',
						tags: [],
						resolvers: [],
					});

					expect(response.body[0].ipAddress).to.be.a('string');
				});
		});
	});
});
