import {expect} from 'chai';
import request, {type SuperTest, type Test} from 'supertest';
import * as td from 'testdouble';
import nock from 'nock';
import RedisCacheMock from '../../../mocks/redis-cache.js';

describe('Create measurement', function () {
	this.timeout(15_000);

	let addFakeProbe;
	let deleteFakeProbe;
	let getTestServer;
	let requestAgent: SuperTest<Test>;

	before(async () => {
		await td.replaceEsm('../../../../src/lib/cache/redis-cache.ts', {}, RedisCacheMock);
		await td.replaceEsm('../../../../src/lib/ip-ranges.ts', {getRegion: () => 'gcp-us-west4', populateMemList: () => Promise.resolve()});
		({getTestServer, addFakeProbe, deleteFakeProbe} = await import('../../../utils/http.js'));
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

	let probe;

	describe('probes connected', () => {
		before(async () => {
			nock('https://globalping-geoip.global.ssl.fastly.net').get(/.*/).reply(200, {
				as: {
					name: "psychz networks",
					number: 40676
				},
				"geo-digitalelement": {
					city: "dallas",
					continent_code: "NA",
					country_code: "US",
					country_code3: "USA",
					country_name: "united states",
					latitude: 32.810,
					longitude: -96.880,
					region: "TX"
				},
				client: {
					proxy_desc: "web-browser",
					proxy_type: "edu"
				}
			});
			nock('https://ipinfo.io').get(/.*/).reply(200, {
				city: "Dallas",
				region: "Texas",
				country: "US",
				loc: "32.7492,-96.8389",
				org: "AS123 Psychz Networks"
			});
			nock('https://geoip.maxmind.com/geoip/v2.1/city/').get(/.*/).reply(200, {
				continent: {
					code: "NA"
				},
				country: {
					isoCode: "US"
				},
				city: {
					names: {
						en: "Dallas"
					}
				},
				location: {
					latitude: 32.814,
					longitude: -96.870
				},
				traits: {
					autonomousSystemNumber: 40676,
					isp: "psychz networks"
				}
			});
			probe = await addFakeProbe();
		});

		after(() => {
			deleteFakeProbe(probe);
		});

		it('should create measurement with global limit', async () => {
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
