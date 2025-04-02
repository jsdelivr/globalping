import { randomUUID } from 'crypto';
import { expect } from 'chai';
import request, { type Agent } from 'supertest';
import * as td from 'testdouble';
import nock from 'nock';
import type { Socket } from 'socket.io-client';
import nockGeoIpProviders from '../../../utils/nock-geo-ip.js';
import { client } from '../../../../src/lib/sql/client.js';
import type { ProbeOverride } from '../../../../src/lib/override/probe-override.js';
import geoIpMocks from '../../../mocks/nock-geoip.json' assert { type: 'json' };

describe('Create measurement', () => {
	let addFakeProbe: () => Promise<Socket>;
	let deleteFakeProbes: (probes?: Socket[]) => Promise<void>;
	let waitForProbesUpdate: () => Promise<void>;
	let getTestServer;
	let requestAgent: Agent;
	let probeOverride: ProbeOverride;
	let DASH_PROBES_TABLE: string;

	before(async () => {
		await td.replaceEsm('../../../../src/lib/ip-ranges.ts', { getRegion: () => 'gcp-us-west4', populateMemList: () => Promise.resolve() });
		({ getTestServer, addFakeProbe, deleteFakeProbes, waitForProbesUpdate } = await import('../../../utils/server.js'));
		({ DASH_PROBES_TABLE } = await import('../../../../src/lib/override/adopted-probes.js'));
		({ probeOverride } = await import('../../../../src/lib/ws/server.js'));
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
					locations: [{ country: 'US' }],
					limit: 2,
				})
				.expect(422)
				.expect((response) => {
					expect(response.body).to.deep.equal({
						error: {
							message: 'No matching IPv4 probes available.',
							type: 'no_probes_found',
						},
						links: {
							documentation: 'https://globalping.io/docs/api.globalping.io#post-/v1/measurements',
						},
					});

					expect(response).to.matchApiSchema();
				});
		});
	});

	let probe: Socket;

	describe('probes connected', () => {
		before(async () => {
			nockGeoIpProviders();
			probe = await addFakeProbe();
			probe.emit('probe:status:update', 'ready');
			probe.emit('probe:isIPv4Supported:update', true);
			probe.emit('probe:isIPv6Supported:update', true);
			await waitForProbesUpdate();
		});

		afterEach(async () => {
			probe.emit('probe:status:update', 'ready');
			probe.emit('probe:isIPv4Supported:update', true);
			probe.emit('probe:isIPv6Supported:update', true);
			await waitForProbesUpdate();
		});

		after(async () => {
			await deleteFakeProbes();
			nock.cleanAll();
		});

		it('should respond with error if there are no ready probes', async () => {
			probe.emit('probe:status:update', 'initializing');
			await waitForProbesUpdate();

			await requestAgent.post('/v1/measurements')
				.send({
					type: 'ping',
					target: 'example.com',
					locations: [{ country: 'US' }],
					limit: 2,
				})
				.expect(422)
				.expect((response) => {
					expect(response.body).to.deep.equal({
						error: {
							message: 'No matching IPv4 probes available.',
							type: 'no_probes_found',
						},
						links: {
							documentation: 'https://globalping.io/docs/api.globalping.io#post-/v1/measurements',
						},
					});

					expect(response).to.matchApiSchema();
				});
		});

		it('should respond with error if probe emitted non-"ready" "probe:status:update"', async () => {
			probe.emit('probe:status:update', 'sigterm');
			await waitForProbesUpdate();

			await requestAgent.post('/v1/measurements')
				.send({
					type: 'ping',
					target: 'example.com',
					locations: [{ country: 'US' }],
					limit: 2,
				})
				.expect(422)
				.expect((response) => {
					expect(response.body).to.deep.equal({
						error: {
							message: 'No matching IPv4 probes available.',
							type: 'no_probes_found',
						},
						links: {
							documentation: 'https://globalping.io/docs/api.globalping.io#post-/v1/measurements',
						},
					});

					expect(response).to.matchApiSchema();
				});
		});

		it('should create measurement with a single probe by default', async () => {
			let id;
			await requestAgent.post('/v1/measurements')
				.send({
					type: 'ping',
					target: 'example.com',
				})
				.expect(202)
				.expect((response) => {
					expect(response.body.id).to.exist;
					expect(response.header['location']).to.exist;
					expect(response.body.probesCount).to.equal(1);
					expect(response).to.matchApiSchema();
					id = response.body.id;
				});

			await requestAgent.get(`/v1/measurements/${id}`)
				.expect(200)
				.expect((response) => {
					expect(response.body.limit).to.not.exist;
					expect(response.body.locations).to.not.exist;
					expect(response).to.matchApiSchema();
				});
		});

		it('should create measurement with global limit', async () => {
			let id;
			await requestAgent.post('/v1/measurements')
				.send({
					type: 'ping',
					target: 'example.com',
					locations: [{ country: 'US' }],
					limit: 2,
				})
				.expect(202)
				.expect((response) => {
					expect(response.body.id).to.exist;
					expect(response.header['location']).to.exist;
					expect(response.body.probesCount).to.equal(1);
					expect(response).to.matchApiSchema();
					id = response.body.id;
				});

			await requestAgent.get(`/v1/measurements/${id}`)
				.expect(200)
				.expect((response) => {
					expect(response.body.limit).to.equal(2);
					expect(response.body.locations).to.deep.equal([{ country: 'US' }]);
					expect(response).to.matchApiSchema();
				});
		});

		it('should create measurement with location limit (continent)', async () => {
			await requestAgent.post('/v1/measurements')
				.send({
					type: 'ping',
					target: 'example.com',
					locations: [{ continent: 'NA', limit: 2 }],
				})
				.expect(202)
				.expect((response) => {
					expect(response.body.id).to.exist;
					expect(response.header['location']).to.exist;
					expect(response.body.probesCount).to.equal(1);
					expect(response).to.matchApiSchema();
				});
		});

		it('should create measurement with location limit (region)', async () => {
			await requestAgent.post('/v1/measurements')
				.send({
					type: 'ping',
					target: 'example.com',
					locations: [{ region: 'Northern America', limit: 2 }],
				})
				.expect(202)
				.expect((response) => {
					expect(response.body.id).to.exist;
					expect(response.header['location']).to.exist;
					expect(response.body.probesCount).to.equal(1);
					expect(response).to.matchApiSchema();
				});
		});

		it('should create measurement with location limit (country)', async () => {
			await requestAgent.post('/v1/measurements')
				.send({
					type: 'ping',
					target: 'example.com',
					locations: [{ country: 'US', limit: 2 }],
				})
				.expect(202)
				.expect((response) => {
					expect(response.body.id).to.exist;
					expect(response.header['location']).to.exist;
					expect(response.body.probesCount).to.equal(1);
					expect(response).to.matchApiSchema();
				});
		});

		it('should create measurement with location limit (state)', async () => {
			await requestAgent.post('/v1/measurements')
				.send({
					type: 'ping',
					target: 'example.com',
					locations: [{ state: 'TX', limit: 2 }],
				})
				.expect(202)
				.expect((response) => {
					expect(response.body.id).to.exist;
					expect(response.header['location']).to.exist;
					expect(response.body.probesCount).to.equal(1);
					expect(response).to.matchApiSchema();
				});
		});

		it('should create measurement with location limit (city)', async () => {
			await requestAgent.post('/v1/measurements')
				.send({
					type: 'ping',
					target: 'example.com',
					locations: [{ city: 'Dallas', limit: 2 }],
				})
				.expect(202)
				.expect((response) => {
					expect(response.body.id).to.exist;
					expect(response.header['location']).to.exist;
					expect(response.body.probesCount).to.equal(1);
					expect(response).to.matchApiSchema();
				});
		});

		it('should create measurement with location limit (asn)', async () => {
			await requestAgent.post('/v1/measurements')
				.send({
					type: 'ping',
					target: 'example.com',
					locations: [{ asn: 20004, limit: 2 }],
				})
				.expect(202)
				.expect((response) => {
					expect(response.body.id).to.exist;
					expect(response.header['location']).to.exist;
					expect(response.body.probesCount).to.equal(1);
					expect(response).to.matchApiSchema();
				});
		});

		it('should create measurement with location limit (network)', async () => {
			await requestAgent.post('/v1/measurements')
				.send({
					type: 'ping',
					target: 'example.com',
					locations: [{ network: 'The Constant Company LLC', limit: 2 }],
				})
				.expect(202)
				.expect((response) => {
					expect(response.body.id).to.exist;
					expect(response.header['location']).to.exist;
					expect(response.body.probesCount).to.equal(1);
					expect(response).to.matchApiSchema();
				});
		});

		it('should create measurement for globally distributed probes', async () => {
			await requestAgent.post('/v1/measurements')
				.send({
					type: 'ping',
					target: 'example.com',
					limit: 2,
				})
				.expect(202)
				.expect((response) => {
					expect(response.body.id).to.exist;
					expect(response.header['location']).to.exist;
					expect(response.body.probesCount).to.equal(1);
					expect(response).to.matchApiSchema();
				});
		});

		it('should create measurement with "magic: world" location', async () => {
			await requestAgent.post('/v1/measurements')
				.send({
					type: 'ping',
					target: 'example.com',
					locations: [{ magic: 'world', limit: 2 }],
				})
				.expect(202)
				.expect((response) => {
					expect(response.body.id).to.exist;
					expect(response.header['location']).to.exist;
					expect(response.body.probesCount).to.equal(1);
					expect(response).to.matchApiSchema();
				});
		});

		it('should create measurement with "magic: World" location in any case', async () => {
			await requestAgent.post('/v1/measurements')
				.send({
					type: 'ping',
					target: 'example.com',
					locations: [{ magic: 'World', limit: 2 }],
				})
				.expect(202)
				.expect((response) => {
					expect(response.body.id).to.exist;
					expect(response.header['location']).to.exist;
					expect(response.body.probesCount).to.equal(1);
					expect(response).to.matchApiSchema();
				});
		});

		it('should create measurement with "magic" value in any case', async () => {
			await requestAgent.post('/v1/measurements')
				.send({
					type: 'ping',
					target: 'example.com',
					locations: [{ magic: 'Na' }],
				})
				.expect(202)
				.expect((response) => {
					expect(response.body.id).to.exist;
					expect(response.header['location']).to.exist;
					expect(response.body.probesCount).to.equal(1);
					expect(response).to.matchApiSchema();
				});
		});

		it('should create measurement with partial tag value "magic: GCP-us-West4" location', async () => {
			await requestAgent.post('/v1/measurements')
				.send({
					type: 'ping',
					target: 'example.com',
					locations: [{ magic: 'GCP-us-West4', limit: 2 }],
				})
				.expect(202)
				.expect((response) => {
					expect(response.body.id).to.exist;
					expect(response.header['location']).to.exist;
					expect(response.body.probesCount).to.equal(1);
					expect(response).to.matchApiSchema();
				});
		});

		it('should not create measurement with "magic: non-existing-tag" location', async () => {
			await requestAgent.post('/v1/measurements')
				.send({
					type: 'ping',
					target: 'example.com',
					locations: [{ magic: 'non-existing-tag', limit: 2 }],
				})
				.expect(422)
				.expect((response) => {
					expect(response.body).to.deep.equal({
						error: {
							message: 'No matching IPv4 probes available.',
							type: 'no_probes_found',
						},
						links: {
							documentation: 'https://globalping.io/docs/api.globalping.io#post-/v1/measurements',
						},
					});

					expect(response).to.matchApiSchema();
				});
		});

		it('should create measurement with "tags: ["tag-value"]" location', async () => {
			await requestAgent.post('/v1/measurements')
				.send({
					type: 'ping',
					target: 'example.com',
					locations: [{ tags: [ 'gcp-us-west4' ], limit: 2 }],
				})
				.expect(202)
				.expect((response) => {
					expect(response.body.id).to.exist;
					expect(response.header['location']).to.exist;
					expect(response.body.probesCount).to.equal(1);
					expect(response).to.matchApiSchema();
				});
		});

		it('should create measurement with the ipVersion option set', async () => {
			let id;
			await requestAgent.post('/v1/measurements')
				.send({
					type: 'ping',
					target: 'example.com',
					measurementOptions: { ipVersion: 6 },
				})
				.expect(202)
				.expect((response) => {
					expect(response.body.id).to.exist;
					expect(response.header['location']).to.exist;
					expect(response.body.probesCount).to.equal(1);
					expect(response).to.matchApiSchema();
					id = response.body.id;
				});

			await requestAgent.get(`/v1/measurements/${id}`)
				.expect(200)
				.expect((response) => {
					expect(response).to.matchApiSchema();
				});
		});

		it('should create measurement with another measurement id location', async () => {
			let id;
			await requestAgent.post('/v1/measurements')
				.send({
					type: 'ping',
					target: 'example.com',
				})
				.expect(202)
				.expect((response) => {
					id = response.body.id;
				});

			let id2;
			await requestAgent.post('/v1/measurements')
				.send({
					type: 'ping',
					target: 'example.com',
					locations: id,
				})
				.expect(202)
				.expect((response) => {
					expect(response.body.id).to.exist;
					expect(response.header['location']).to.exist;
					expect(response.body.probesCount).to.equal(1);
					expect(response).to.matchApiSchema();
					id2 = response.body.id;
				});

			await requestAgent.get(`/v1/measurements/${id2}`)
				.expect(200)
				.expect((response) => {
					expect(response.body.limit).to.not.exist;
					expect(response.body.locations).to.not.exist;
					expect(response).to.matchApiSchema();
				});
		});

		it('should create measurement with another measurement id location and copy its limit and locations', async () => {
			let id;
			await requestAgent.post('/v1/measurements')
				.send({
					type: 'ping',
					target: 'example.com',
					limit: 10,
					locations: [{
						continent: 'NA',
					}],
				})
				.expect(202)
				.expect((response) => {
					id = response.body.id;
				});

			let id2;
			await requestAgent.post('/v1/measurements')
				.send({
					type: 'ping',
					target: 'example.com',
					locations: id,
				})
				.expect(202)
				.expect((response) => {
					expect(response.body.id).to.exist;
					expect(response.header['location']).to.exist;
					expect(response.body.probesCount).to.equal(1);
					expect(response).to.matchApiSchema();
					id2 = response.body.id;
				});

			await requestAgent.get(`/v1/measurements/${id2}`)
				.expect(200)
				.expect((response) => {
					expect(response.body.limit).to.equal(10);
					expect(response.body.locations).to.deep.equal([{ continent: 'NA' }]);
					expect(response).to.matchApiSchema();
				});
		});

		it('should create measurement with measurement id created from measurement id', async () => {
			let id1;
			await requestAgent.post('/v1/measurements')
				.send({
					type: 'ping',
					target: 'example.com',
				})
				.expect(202)
				.expect((response) => {
					id1 = response.body.id;
				});

			let id2;
			await requestAgent.post('/v1/measurements')
				.send({
					type: 'ping',
					target: 'example.com',
					locations: id1,
				})
				.expect(202)
				.expect((response) => {
					id2 = response.body.id;
				});


			await requestAgent.post('/v1/measurements')
				.send({
					type: 'ping',
					target: 'example.com',
					locations: id2,
				})
				.expect(202)
				.expect((response) => {
					expect(response.body.id).to.exist;
					expect(response.header['location']).to.exist;
					expect(response.body.probesCount).to.equal(1);
					expect(response).to.matchApiSchema();
				});
		});

		it('should create measurement with another measurement id location passed in magic field', async () => {
			let id;
			await requestAgent.post('/v1/measurements')
				.send({
					type: 'ping',
					target: 'example.com',
					limit: 2,
					locations: [{ country: 'US' }],
				})
				.expect(202)
				.expect((response) => {
					id = response.body.id;
				});

			let id2;
			await requestAgent.post('/v1/measurements')
				.send({
					type: 'ping',
					target: 'example.com',
					locations: [{ magic: id }],
				})
				.expect(202)
				.expect((response) => {
					expect(response.body.id).to.exist;
					expect(response.header['location']).to.exist;
					expect(response.body.probesCount).to.equal(1);
					expect(response).to.matchApiSchema();
					id2 = response.body.id;
				});

			await requestAgent.get(`/v1/measurements/${id2}`)
				.expect(200)
				.expect((response) => {
					expect(response.body.limit).to.equal(2);
					expect(response.body.locations).to.deep.equal([{ country: 'US' }]);
					expect(response).to.matchApiSchema();
				});
		});

		it('should respond with error if there is no requested measurement id', async () => {
			await requestAgent.post('/v1/measurements')
				.send({
					type: 'ping',
					target: 'example.com',
					locations: 'nonExistingid',
				})
				.expect(422)
				.expect((response) => {
					expect(response.body).to.deep.equal({
						error: {
							message: 'No matching IPv4 probes available.',
							type: 'no_probes_found',
						},
						links: {
							documentation: 'https://globalping.io/docs/api.globalping.io#post-/v1/measurements',
						},
					});

					expect(response).to.matchApiSchema();
				});
		});

		describe('offline probes', () => {
			after(async () => {
				probe.emit('probe:status:update', 'ready');
				probe.emit('probe:isIPv4Supported:update', true);
				await waitForProbesUpdate();
			});

			it('should create measurement with offline test result if requested probe is offline', async () => {
				let id;
				await requestAgent.post('/v1/measurements')
					.send({
						type: 'ping',
						target: 'example.com',
						locations: [{
							continent: 'NA',
						}],
					})
					.expect(202)
					.expect((response) => {
						id = response.body.id;
					});

				probe.emit('probe:status:update', 'ping-test-failed');
				await waitForProbesUpdate();

				let id2;
				await requestAgent.post('/v1/measurements')
					.send({
						type: 'ping',
						target: 'example.com',
						locations: id,
					})
					.expect(202)
					.expect((response) => {
						expect(response.body.id).to.exist;
						expect(response.header['location']).to.exist;
						expect(response.body.probesCount).to.equal(1);
						expect(response).to.matchApiSchema();
						id2 = response.body.id;
					});

				await requestAgent.get(`/v1/measurements/${id2}`)
					.expect(200)
					.expect((response) => {
						expect(response.body.locations).to.deep.equal([{ continent: 'NA' }]);
						expect(response.body.results[0].result.status).to.equal('offline');
						expect(response.body.results[0].result.rawOutput).to.equal('This probe is currently offline. Please try again later.');
						expect(response).to.matchApiSchema();
					});
			});
		});

		describe('adopted probes', () => {
			before(async () => {
				await client(DASH_PROBES_TABLE).insert({
					id: randomUUID(),
					userId: '89da69bd-a236-4ab7-9c5d-b5f52ce09959',
					lastSyncDate: new Date(),
					ip: '1.2.3.4',
					uuid: '1-1-1-1-1',
					tags: '[{"prefix":"jsdelivr","value":"Dashboard-Tag"}]',
					status: 'ready',
					isIPv4Supported: true,
					isIPv6Supported: true,
					version: '0.26.0',
					nodeVersion: 'v18.14.2',
					country: 'US',
					city: 'Oklahoma City',
					latitude: 35.47,
					longitude: -97.52,
					state: 'OK',
					network: 'InterBS S.R.L. (BAEHOST)',
					asn: 61004,
					allowedCountries: '["US"]',
					customLocation: JSON.stringify({
						country: 'US',
						city: 'Oklahoma City',
						latitude: 35.47,
						longitude: -97.52,
						state: 'OK',
					}),
				});

				await probeOverride.fetchDashboardData();
				await waitForProbesUpdate();
			});

			after(async () => {
				await client(DASH_PROBES_TABLE).where({ city: 'Oklahoma City' }).delete();
			});

			it('should create measurement with adopted "city: Oklahoma City" location', async () => {
				await requestAgent.post('/v1/measurements')
					.send({
						type: 'ping',
						target: 'example.com',
						locations: [{ city: 'Oklahoma City', limit: 2 }],
					})
					.expect(202)
					.expect((response) => {
						expect(response.body.id).to.exist;
						expect(response.header['location']).to.exist;
						expect(response.body.probesCount).to.equal(1);
						expect(response).to.matchApiSchema();
					});
			});

			it('should create measurement with adopted "tags: ["u-jsdelivr:dashboard-tag"]" location', async () => {
				await requestAgent.post('/v1/measurements')
					.send({
						type: 'ping',
						target: 'example.com',
						locations: [{ tags: [ 'u-jsdelivr:dashboard-tag' ], limit: 2 }],
					})
					.expect(202)
					.expect((response) => {
						expect(response.body.id).to.exist;
						expect(response.header['location']).to.exist;
						expect(response.body.probesCount).to.equal(1);
						expect(response).to.matchApiSchema();
					});
			});

			it('should create measurement with adopted "tags: ["u-jsdelivr:Dashboard-Tag"]" in any letter case', async () => {
				await requestAgent.post('/v1/measurements')
					.send({
						type: 'ping',
						target: 'example.com',
						locations: [{ tags: [ 'u-jsdelivr:Dashboard-Tag' ], limit: 2 }],
					})
					.expect(202)
					.expect((response) => {
						expect(response.body.id).to.exist;
						expect(response.header['location']).to.exist;
						expect(response.body.probesCount).to.equal(1);
						expect(response).to.matchApiSchema();
					});
			});

			describe('user tag in magic field', () => {
				let probe2: Socket;
				before(async () => {
					nock('https://ipmap-api.ripe.net/v1/locate/').get(/.*/).reply(400);
					nock('https://api.ip2location.io').get(/.*/).reply(400);
					nock('https://globalping-geoip.global.ssl.fastly.net').get(/.*/).reply(400);
					nock('https://geoip.maxmind.com/geoip/v2.1/city/').get(/.*/).reply(400);

					// Creating an AR probe which has a tag value inside of the content (network name).
					nock('https://ipinfo.io').get(/.*/).reply(200, {
						...geoIpMocks.ipinfo.argentina,
						org: 'AS61004 InterBS u-jsdelivr:dashboard-tag S.R.L.',
					});

					probe2 = await addFakeProbe();
					probe2.emit('probe:status:update', 'ready');
					probe2.emit('probe:isIPv4Supported:update', true);
					probe2.emit('probe:isIPv6Supported:update', true);
					await waitForProbesUpdate();
				});

				after(() => {
					deleteFakeProbes([ probe2 ]);
				});

				it('should prefer a probe with a match in other field over the probe with match in user tag', async () => {
					let measurementId;
					await requestAgent.post('/v1/measurements')
						.send({
							type: 'ping',
							target: 'example.com',
							locations: [{ magic: 'u-jsdelivr:dashboard-tag', limit: 2 }],
						})
						.expect(202)
						.expect((response) => {
							measurementId = response.body.id;
							expect(response.body.id).to.exist;
							expect(response.header['location']).to.exist;
							expect(response.body.probesCount).to.equal(1);
							expect(response).to.matchApiSchema();
						});

					await requestAgent.get(`/v1/measurements/${measurementId}`)
						.expect(200)
						.expect((response) => {
							expect(response.body.results[0].probe.country).to.equal('AR');
						});
				});
			});

			it('should prefer a probe with user tag in a magic field if there are no matches in other fields', async () => {
				let measurementId;
				await requestAgent.post('/v1/measurements')
					.send({
						type: 'ping',
						target: 'example.com',
						locations: [{ magic: 'u-jsdelivr:dashboard-tag', limit: 2 }],
					})
					.expect(202)
					.expect((response) => {
						measurementId = response.body.id;
						expect(response.body.id).to.exist;
						expect(response.header['location']).to.exist;
						expect(response.body.probesCount).to.equal(1);
						expect(response).to.matchApiSchema();
					});

				await requestAgent.get(`/v1/measurements/${measurementId}`)
					.expect(200)
					.expect((response) => {
						expect(response.body.results[0].probe.country).to.equal('US');
					});
			});

			it('should prefer a probe with any-case user tag in a magic field if there are no matches in other fields', async () => {
				await requestAgent.post('/v1/measurements')
					.send({
						type: 'ping',
						target: 'example.com',
						locations: [{ magic: 'U-JSdelivr:Dashboard-TAG', limit: 2 }],
					})
					.expect(202)
					.expect((response) => {
						expect(response.body.id).to.exist;
						expect(response.header['location']).to.exist;
						expect(response.body.probesCount).to.equal(1);
						expect(response).to.matchApiSchema();
					});
			});
		});

		describe('adopted probes + admin overrides', () => {
			before(async () => {
				await client(DASH_PROBES_TABLE).insert({
					id: randomUUID(),
					userId: '89da69bd-a236-4ab7-9c5d-b5f52ce09959',
					lastSyncDate: new Date(),
					ip: '1.2.3.4',
					uuid: '1-1-1-1-1',
					tags: '[{"prefix":"jsdelivr","value":"Dashboard-Tag"}]',
					status: 'ready',
					isIPv4Supported: true,
					isIPv6Supported: true,
					version: '0.26.0',
					nodeVersion: 'v18.14.2',
					country: 'US',
					city: 'Oklahoma City',
					latitude: 35.47,
					longitude: -97.52,
					state: 'OK',
					network: 'InterBS S.R.L. (BAEHOST)',
					asn: 61004,
					allowedCountries: '["US"]',
					customLocation: JSON.stringify({
						country: 'US',
						city: 'Oklahoma City',
						latitude: 35.47,
						longitude: -97.52,
						state: 'OK',
					}),
				});

				await client('gp_location_overrides').insert({
					id: 5,
					ip_range: '1.2.3.4/24',
					city: 'Paris',
					country: 'FR',
					latitude: 48.85,
					longitude: 2.35,
				});

				await probeOverride.fetchDashboardData();
				await waitForProbesUpdate();
			});

			after(async () => {
				await client(DASH_PROBES_TABLE).where({ city: 'Oklahoma City' }).delete();
				await client('gp_location_overrides').where({ city: 'Paris' }).delete();
			});

			it('should ignore adopted custom city if admin data says it is another country', async () => {
				await requestAgent.post('/v1/measurements')
					.send({
						type: 'ping',
						target: 'example.com',
						locations: [{ city: 'Oklahoma City', limit: 2 }],
					})
					.expect(422);
			});
		});
	});
});
