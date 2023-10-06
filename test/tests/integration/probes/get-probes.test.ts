/* eslint-disable @typescript-eslint/no-unused-vars */
import nock from 'nock';
import { expect } from 'chai';
import request, { type SuperTest, type Test } from 'supertest';
import type { Socket } from 'socket.io-client';
import { getTestServer, addFakeProbe, deleteFakeProbe } from '../../../utils/server.js';
import nockGeoIpProviders from '../../../utils/nock-geo-ip.js';

describe('Get Probes', () => {
	let requestAgent: SuperTest<Test>;
	const probes: Socket[] = [];
	let addProbe: () => Promise<Socket>;

	before(async () => {
		addProbe = async () => {
			const probe = await addFakeProbe();
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

			await addProbe();

			await requestAgent.get('/v1/probes')
				.send()
				.expect(200)
				.expect((response) => {
					expect(response.body).to.deep.equal([]);
					expect(response).to.matchApiSchema();
				});
		});

		it('should detect 1 probe in "ready: true" status', async () => {
			nockGeoIpProviders({ maxmind: 'argentina', ipinfo: 'argentina', fastly: 'argentina' });

			const probe = await addProbe();
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
							asn: 61004,
							latitude: -34.6131,
							longitude: -58.3772,
							network: 'InterBS S.R.L. (BAEHOST)',
						},
						tags: [],
						resolvers: [],
					}]);

					expect(response).to.matchApiSchema();
				});
		});

		it('should detect 2 probes in "ready: true" status', async () => {
			nockGeoIpProviders({ ip2location: 'argentina', ipmap: 'argentina', maxmind: 'argentina', ipinfo: 'argentina', fastly: 'argentina' });
			nockGeoIpProviders();

			const probe1 = await addProbe();
			const probe2 = await addProbe();
			probe1.emit('probe:status:update', 'ready');
			probe2.emit('probe:status:update', 'ready');

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
								asn: 61004,
								latitude: -34.6131,
								longitude: -58.3772,
								network: 'InterBS S.R.L. (BAEHOST)',
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
								asn: 20004,
								latitude: 32.7831,
								longitude: -96.8067,
								network: 'The Constant Company LLC',
							},
							tags: [ 'datacenter-network' ],
							resolvers: [],
						},
					]);

					expect(response).to.matchApiSchema();
				});
		});

		it('should detect 4 probes in "ready: true" status', async () => {
			nockGeoIpProviders({ ip2location: 'argentina', ipmap: 'argentina', maxmind: 'argentina', ipinfo: 'argentina', fastly: 'argentina' });
			nockGeoIpProviders();
			nockGeoIpProviders({ ip2location: 'newYork', ipmap: 'argentina', maxmind: 'newYork', ipinfo: 'newYork', fastly: 'newYork' });
			nockGeoIpProviders({ ip2location: 'washington', ipmap: 'argentina', maxmind: 'default', ipinfo: 'washington', fastly: 'newYork' });

			const probe1 = await addProbe();
			const probe2 = await addProbe();
			const probe3 = await addProbe();
			const probe4 = await addProbe();
			probe1.emit('probe:status:update', 'ready');
			probe2.emit('probe:status:update', 'ready');
			probe3.emit('probe:status:update', 'ready');
			probe4.emit('probe:status:update', 'ready');

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
								asn: 61004,
								latitude: -34.6131,
								longitude: -58.3772,
								network: 'InterBS S.R.L. (BAEHOST)',
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
								asn: 20004,
								latitude: 32.7831,
								longitude: -96.8067,
								network: 'The Constant Company LLC',
							},
							tags: [ 'datacenter-network' ],
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
								asn: 80004,
								latitude: 40.7143,
								longitude: -74.0060,
								network: 'The Constant Company LLC',
							},
							tags: [ 'datacenter-network' ],
							resolvers: [],
						},
						{
							version: '0.14.0',
							location: {
								asn: 701,
								city: 'Washington',
								continent: 'NA',
								country: 'US',
								latitude: 38.89539,
								longitude: -77.039476,
								network: 'Verizon Business',
								region: 'Northern America',
								state: 'DC',
							},
							tags: [ 'eyeball-network' ],
							resolvers: [],
						},
					]);

					expect(response).to.matchApiSchema();
				});
		});

		it('should detect only "ready" probes and filter out other', async () => {
			nockGeoIpProviders({ ip2location: 'argentina', ipmap: 'argentina', maxmind: 'argentina', ipinfo: 'argentina', fastly: 'argentina' });
			nockGeoIpProviders();

			const probe1 = await addProbe();
			await addProbe();
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
							asn: 61004,
							latitude: -34.6131,
							longitude: -58.3772,
							network: 'InterBS S.R.L. (BAEHOST)',
						},
						tags: [],
						resolvers: [],
					}]);

					expect(response).to.matchApiSchema();
				});
		});

		it('should add extra info if admin key is provided', async () => {
			nockGeoIpProviders({ ip2location: 'argentina', ipmap: 'argentina', maxmind: 'argentina', ipinfo: 'argentina', fastly: 'argentina' });

			const probe = await addProbe();
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
							asn: 61004,
							latitude: -34.6131,
							longitude: -58.3772,
							network: 'InterBS S.R.L. (BAEHOST)',
						},
						stats: { cpu: { count: 0, load: [] }, jobs: { count: 0 } },
						status: 'ready',
						tags: [],
						resolvers: [],
					});

					expect(response.body[0].ipAddress).to.be.a('string');
					expect(response).to.matchApiSchema();
				});
		});
	});
});
