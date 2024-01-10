/* eslint-disable @typescript-eslint/no-unused-vars */
import nock from 'nock';
import { expect } from 'chai';
import request, { type SuperTest, type Test } from 'supertest';
import { getTestServer, addFakeProbe, deleteFakeProbes } from '../../../utils/server.js';
import nockGeoIpProviders from '../../../utils/nock-geo-ip.js';
import { adoptedProbes, ADOPTED_PROBES_TABLE } from '../../../../src/lib/adopted-probes.js';
import { client } from '../../../../src/lib/sql/client.js';

describe('Get Probes', () => {
	let requestAgent: SuperTest<Test>;

	before(async () => {
		const app = await getTestServer();
		requestAgent = request(app);
	});

	afterEach(async () => {
		nock.cleanAll();
		await deleteFakeProbes();
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
					expect(response).to.matchApiSchema();
				});
		});

		it('should detect 4 probes in "ready: true" status', async () => {
			nockGeoIpProviders({ ip2location: 'argentina', ipmap: 'argentina', maxmind: 'argentina', ipinfo: 'argentina', fastly: 'argentina' });
			nockGeoIpProviders();
			nockGeoIpProviders({ ip2location: 'newYork', ipmap: 'argentina', maxmind: 'newYork', ipinfo: 'newYork', fastly: 'newYork' });
			nockGeoIpProviders({ ip2location: 'washington', ipmap: 'argentina', maxmind: 'default', ipinfo: 'washington', fastly: 'newYork' });

			const probe1 = await addFakeProbe();
			const probe2 = await addFakeProbe();
			const probe3 = await addFakeProbe();
			const probe4 = await addFakeProbe();
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
								state: null,
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
							state: null,
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

			const probe = await addFakeProbe();
			probe.emit('probe:status:update', 'ready');

			await requestAgent.get('/v1/probes?adminkey=admin')
				.send()
				.expect(200)
				.expect((response) => {
					expect(response.body[0]).to.deep.equal({
						version: '0.14.0',
						host: '',
						ipAddress: '1.2.3.4',
						uuid: '1-1-1-1-1',
						nodeVersion: 'v18.17.0',
						location: {
							continent: 'SA',
							region: 'South America',
							country: 'AR',
							state: null,
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

		it('should add extra info if system key is provided', async () => {
			nockGeoIpProviders({ ip2location: 'argentina', ipmap: 'argentina', maxmind: 'argentina', ipinfo: 'argentina', fastly: 'argentina' });

			const probe = await addFakeProbe();
			probe.emit('probe:status:update', 'ready');

			await requestAgent.get('/v1/probes?systemkey=system')
				.send()
				.expect(200)
				.expect((response) => {
					expect(response.body[0]).to.deep.equal({
						version: '0.14.0',
						ipAddress: '1.2.3.4',
						location: {
							continent: 'SA',
							region: 'South America',
							country: 'AR',
							state: null,
							city: 'Buenos Aires',
							asn: 61004,
							latitude: -34.6131,
							longitude: -58.3772,
							network: 'InterBS S.R.L. (BAEHOST)',
						},
						status: 'ready',
						tags: [],
						resolvers: [],
					});

					expect(response.body[0].ipAddress).to.be.a('string');
					expect(response).to.matchApiSchema();
				});
		});

		it('should add hardware info if admin key is provided and there is hardware info', async () => {
			nockGeoIpProviders({ ip2location: 'argentina', ipmap: 'argentina', maxmind: 'argentina', ipinfo: 'argentina', fastly: 'argentina' });

			const probe = await addFakeProbe({}, { query: { isHardware: 'true', hardwareDevice: 'v1' } });
			probe.emit('probe:status:update', 'ready');

			await requestAgent.get('/v1/probes?adminkey=admin')
				.send()
				.expect(200)
				.expect((response) => {
					expect(response.body[0]).to.deep.include({
						isHardware: true,
						hardwareDevice: 'v1',
					});

					expect(response.body[0].ipAddress).to.be.a('string');
					expect(response).to.matchApiSchema();
				});
		});

		describe('adopted probes', () => {
			before(async () => {
				await client(ADOPTED_PROBES_TABLE).insert({
					userId: '89da69bd-a236-4ab7-9c5d-b5f52ce09959',
					lastSyncDate: new Date(),
					ip: '1.2.3.4',
					uuid: '1-1-1-1-1',
					isCustomCity: 1,
					tags: '[{"prefix":"jimaek","value":"dashboardtag1"}]',
					status: 'ready',
					version: '0.26.0',
					country: 'AR',
					countryOfCustomCity: 'AR',
					city: 'Cordoba',
					latitude: '-31.4135',
					longitude: '-64.18105',
					network: 'InterBS S.R.L. (BAEHOST)',
					asn: 61004,
				});

				await adoptedProbes.syncDashboardData();
			});

			after(async () => {
				await client(ADOPTED_PROBES_TABLE).where({ city: 'Cordoba' }).delete();
			});

			it('should update probes data', async () => {
				nockGeoIpProviders({ ip2location: 'argentina', ipmap: 'argentina', maxmind: 'argentina', ipinfo: 'argentina', fastly: 'argentina' });
				const probe = await addFakeProbe();
				probe.emit('probe:status:update', 'ready');

				await requestAgent.get('/v1/probes')
					.send()
					.expect(200)
					.expect((response) => {
						expect(response.body[0]).to.deep.equal({
							version: '0.14.0',
							location: {
								continent: 'SA',
								region: 'South America',
								country: 'AR',
								state: null,
								city: 'Cordoba',
								latitude: -31.4135,
								longitude: -64.18105,
								asn: 61004,
								network: 'InterBS S.R.L. (BAEHOST)',
							},
							tags: [ 'u-jimaek-dashboardtag1' ],
							resolvers: [],
						});

						expect(response).to.matchApiSchema();
					});
			});
		});
	});
});
