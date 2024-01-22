
import { expect } from 'chai';
import request, { type Agent } from 'supertest';
import * as td from 'testdouble';
import nock from 'nock';
import type { Socket } from 'socket.io-client';
import nockGeoIpProviders from '../../../utils/nock-geo-ip.js';
import { client } from '../../../../src/lib/sql/client.js';
import type { AdoptedProbes } from '../../../../src/lib/adopted-probes.js';

describe('Create measurement', () => {
	let addFakeProbe: () => Promise<Socket>;
	let deleteFakeProbes: (socket: Socket) => Promise<void>;
	let getTestServer;
	let requestAgent: Agent;
	let adoptedProbes: AdoptedProbes;
	let ADOPTED_PROBES_TABLE: string;

	before(async () => {
		await td.replaceEsm('../../../../src/lib/ip-ranges.ts', { getRegion: () => 'gcp-us-west4', populateMemList: () => Promise.resolve() });
		({ getTestServer, addFakeProbe, deleteFakeProbes } = await import('../../../utils/server.js'));
		({ adoptedProbes, ADOPTED_PROBES_TABLE } = await import('../../../../src/lib/adopted-probes.js'));
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
							message: 'No suitable probes found.',
							type: 'no_probes_found',
						},
						links: {
							documentation: 'https://www.jsdelivr.com/docs/api.globalping.io#post-/v1/measurements',
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
		});

		afterEach(() => {
			probe.emit('probe:status:update', 'ready');
		});

		after(async () => {
			await deleteFakeProbes(probe);
			nock.cleanAll();
		});

		it('should respond with error if there are no ready probes', async () => {
			probe.emit('probe:status:update', 'initializing');

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
							message: 'No suitable probes found.',
							type: 'no_probes_found',
						},
						links: {
							documentation: 'https://www.jsdelivr.com/docs/api.globalping.io#post-/v1/measurements',
						},
					});

					expect(response).to.matchApiSchema();
				});
		});

		it('should respond with error if probe emitted non-"ready" "probe:status:update"', async () => {
			probe.emit('probe:status:update', 'sigterm');

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
							message: 'No suitable probes found.',
							type: 'no_probes_found',
						},
						links: {
							documentation: 'https://www.jsdelivr.com/docs/api.globalping.io#post-/v1/measurements',
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
			probe.emit('probe:status:update', 'ready');

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
			probe.emit('probe:status:update', 'ready');

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
			probe.emit('probe:status:update', 'ready');

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
			probe.emit('probe:status:update', 'ready');

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
			probe.emit('probe:status:update', 'ready');

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
			probe.emit('probe:status:update', 'ready');

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
			probe.emit('probe:status:update', 'ready');

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
							message: 'No suitable probes found.',
							type: 'no_probes_found',
						},
						links: {
							documentation: 'https://www.jsdelivr.com/docs/api.globalping.io#post-/v1/measurements',
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
							message: 'No suitable probes found.',
							type: 'no_probes_found',
						},
						links: {
							documentation: 'https://www.jsdelivr.com/docs/api.globalping.io#post-/v1/measurements',
						},
					});

					expect(response).to.matchApiSchema();
				});
		});

		describe('offline probes', () => {
			after(() => {
				probe.emit('probe:status:update', 'ready');
			});

			it('should create measurement with offline test result if requested probe is offline', async () => {
				let id;
				await requestAgent.post('/v1/measurements')
					.send({
						type: 'ping',
						target: 'example.com',
						limit: 2,
						locations: [{
							continent: 'NA',
						}],
					})
					.expect(202)
					.expect((response) => {
						id = response.body.id;
					});

				probe.emit('probe:status:update', 'ping-test-failed');

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
						expect(response.body.limit).to.equal(2);
						expect(response.body.locations).to.deep.equal([{ continent: 'NA' }]);
						expect(response.body.results[0].result.status).to.equal('offline');
						expect(response.body.results[0].result.rawOutput).to.equal('This probe is currently offline. Please try again later.');
						expect(response).to.matchApiSchema();
					});
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
					tags: '[{"prefix":"jsdelivr","value":"Dashboard-Tag"}]',
					status: 'ready',
					version: '0.26.0',
					country: 'US',
					countryOfCustomCity: 'US',
					city: 'Oklahoma City',
					latitude: '35.46756',
					longitude: '-97.51643',
					network: 'InterBS S.R.L. (BAEHOST)',
					asn: 61004,
				});

				await adoptedProbes.syncDashboardData();
			});

			after(async () => {
				await client(ADOPTED_PROBES_TABLE).where({ city: 'Oklahoma City' }).delete();
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

			it('should create measurement with adopted "tags: ["u-jsdelivr-dashboard-tag"]" location', async () => {
				await requestAgent.post('/v1/measurements')
					.send({
						type: 'ping',
						target: 'example.com',
						locations: [{ tags: [ 'u-jsdelivr-dashboard-tag' ], limit: 2 }],
					})
					.expect(202)
					.expect((response) => {
						expect(response.body.id).to.exist;
						expect(response.header['location']).to.exist;
						expect(response.body.probesCount).to.equal(1);
						expect(response).to.matchApiSchema();
					});
			});

			it('should create measurement with adopted "tags: ["u-jsdelivr-Dashboard-Tag"]" in any letter case', async () => {
				await requestAgent.post('/v1/measurements')
					.send({
						type: 'ping',
						target: 'example.com',
						locations: [{ tags: [ 'u-jsdelivr-Dashboard-Tag' ], limit: 2 }],
					})
					.expect(202)
					.expect((response) => {
						expect(response.body.id).to.exist;
						expect(response.header['location']).to.exist;
						expect(response.body.probesCount).to.equal(1);
						expect(response).to.matchApiSchema();
					});
			});

			it('should not use create measurement with adopted tag in magic field "magic: ["u-jsdelivr-dashboard-tag"]" location', async () => {
				await requestAgent.post('/v1/measurements')
					.send({
						type: 'ping',
						target: 'example.com',
						locations: [{ magic: 'u-jsdelivr-dashboard-tag', limit: 2 }],
					})
					.expect(422).expect((response) => {
						expect(response.body.error.message).to.equal('No suitable probes found.');
					});
			});
		});
	});
});
