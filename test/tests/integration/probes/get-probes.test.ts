import fs from 'node:fs';
import nock from 'nock';
import {expect} from 'chai';
import request, {type SuperTest, type Test} from 'supertest';
import * as td from 'testdouble';
import RedisCacheMock from '../../../mocks/redis-cache.js';

const nockMocks = JSON.parse(fs.readFileSync('./test/mocks/nock-geoip.json').toString()) as Record<string, any>;

describe('Get Probes', function () {
	this.timeout(15_000);

	let addFakeProbe;
	let deleteFakeProbe;
	let requestAgent: SuperTest<Test>;

	before(async () => {
		await td.replaceEsm('../../../../src/lib/cache/redis-cache.ts', {}, RedisCacheMock);
		const http = await import('../../../utils/http.js');
		addFakeProbe = http.addFakeProbe;
		deleteFakeProbe = http.deleteFakeProbe;
		const app = await http.getTestServer();
		requestAgent = request(app);
	});

	after(() => {
		td.reset();
	});

	describe('probes not connected', () => {
		it('should respond with an empty array', async () => {
			await requestAgent.get('/v1/probes')
				.send()
				.expect(200)
				.expect(response => {
					expect(response.body).to.deep.equal([]);
				});
		});
	});

	describe('probes connected', () => {
		it('should detect 1 probe', async () => {
			nock('https://globalping-geoip.global.ssl.fastly.net').get(/.*/).reply(200, nockMocks['00.00'].fastly);
			nock('https://ipinfo.io').get(/.*/).reply(200, nockMocks['00.00'].ipinfo);
			nock('https://geoip.maxmind.com/geoip/v2.1/city/').get(/.*/).reply(200, nockMocks['00.00'].maxmind);

			const probe = await addFakeProbe();

			await requestAgent.get('/v1/probes')
				.send()
				.expect(200)
				.expect(response => {
					expect(response.body).to.deep.equal([{
							version: '0.14.0',
							ready: true,
							location: {
								continent: 'SA',
								region: 'Southern America',
								country: 'AR',
								city: 'Buenos Aires',
								asn: 61493,
								latitude: -34.602,
								longitude: -58.384,
								network: 'interbs s.r.l.'
							},
							tags: [],
							resolvers: []
						}]);
				});

			await deleteFakeProbe(probe);
		});

		it('should detect 2 probes', async () => {
			nock('https://globalping-geoip.global.ssl.fastly.net')
				.get(/.*/).reply(200, nockMocks['00.00'].fastly)
				.get(/.*/).reply(200, nockMocks['01.00'].fastly);
			nock('https://ipinfo.io')
				.get(/.*/).reply(200, nockMocks['00.00'].ipinfo)
				.get(/.*/).reply(200, nockMocks['01.00'].ipinfo);
			nock('https://geoip.maxmind.com/geoip/v2.1/city/')
				.get(/.*/).reply(200, nockMocks['00.00'].maxmind)
				.get(/.*/).reply(200, nockMocks['01.00'].maxmind);

			const probe1 = await addFakeProbe();
			const probe2 = await addFakeProbe();

			await requestAgent.get('/v1/probes')
				.send()
				.expect(200)
				.expect(response => {
					expect(response.body).to.deep.equal([{
							version: '0.14.0',
							ready: true,
							location: {
								continent: 'SA',
								region: 'Southern America',
								country: 'AR',
								city: 'Buenos Aires',
								asn: 61493,
								latitude: -34.602,
								longitude: -58.384,
								network: 'interbs s.r.l.'
							},
							tags: [],
							resolvers: []
						},
						{
							version: '0.14.0',
							ready: true,
							location: {
								continent: 'NA',
								region: 'Northern America',
								country: 'US',
								state: 'TX',
								city: 'Dallas',
								asn: 123,
								latitude: 32.7492,
								longitude: -96.8389,
								network: 'Psychz Networks'
							},
							tags: [],
							resolvers: []
						}]);
				});

				await deleteFakeProbe(probe1);
				await deleteFakeProbe(probe2);
		});

		it('should detect 3 probes', async () => {
			nock('https://globalping-geoip.global.ssl.fastly.net')
				.get(/.*/).reply(200, nockMocks['00.00'].fastly)
				.get(/.*/).reply(200, nockMocks['01.00'].fastly)
				.get(/.*/).reply(200, nockMocks['00.04'].fastly);
			nock('https://ipinfo.io')
				.get(/.*/).reply(200, nockMocks['00.00'].ipinfo)
				.get(/.*/).reply(200, nockMocks['01.00'].ipinfo)
				.get(/.*/).reply(200, nockMocks['00.04'].ipinfo);
			nock('https://geoip.maxmind.com/geoip/v2.1/city/')
				.get(/.*/).reply(200, nockMocks['00.00'].maxmind)
				.get(/.*/).reply(200, nockMocks['01.00'].maxmind)
				.get(/.*/).reply(200, nockMocks['00.04'].maxmind);

			const probe1 = await addFakeProbe();
			const probe2 = await addFakeProbe();
			const probe3 = await addFakeProbe();

			await requestAgent.get('/v1/probes')
				.send()
				.expect(200)
				.expect(response => {
					expect(response.body).to.deep.equal([
						{
							version: '0.14.0',
							ready: true,
							location: {
								continent: 'SA',
								region: 'Southern America',
								country: 'AR',
								city: 'Buenos Aires',
								asn: 61493,
								latitude: -34.602,
								longitude: -58.384,
								network: 'interbs s.r.l.'
							},
							tags: [],
							resolvers: []
						},
						{
							version: '0.14.0',
							ready: true,
							location: {
								continent: 'NA',
								region: 'Northern America',
								country: 'US',
								state: 'TX',
								city: 'Dallas',
								asn: 123,
								latitude: 32.7492,
								longitude: -96.8389,
								network: 'Psychz Networks'
							},
							tags: [],
							resolvers: []
						},
						{
							version: '0.14.0',
							ready: true,
							location: {
								continent: 'NA',
								region: 'Northern America',
								country: 'US',
								state: 'NY',
								city: 'New York',
								asn: 61493,
								latitude: -7.7568,
								longitude: -35.3656,
								network: 'InterBS S.R.L. (BAEHOST)'
							},
							tags: [],
							resolvers: []
						}
					]);
				});

				await deleteFakeProbe(probe1);
				await deleteFakeProbe(probe2);
				await deleteFakeProbe(probe3);
		});
	});
});
