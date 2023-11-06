
import { expect } from 'chai';
import request, { type SuperTest, type Test } from 'supertest';
import * as td from 'testdouble';
import nock from 'nock';
import type { Socket } from 'socket.io-client';
import nockGeoIpProviders from '../../../utils/nock-geo-ip.js';
import { client } from '../../../../src/lib/sql/client.js';
import type { AdoptedProbes } from '../../../../src/lib/adopted-probes.js';

describe('Create measurement', () => {
	let addFakeProbe: () => Promise<Socket>;
	let deleteFakeProbe: (socket: Socket) => Promise<void>;
	let getTestServer;
	let requestAgent: SuperTest<Test>;
	let adoptedProbes: AdoptedProbes;
	let ADOPTED_PROBES_TABLE: string;

	before(async () => {
		await td.replaceEsm('../../../../src/lib/ip-ranges.ts', { getRegion: () => 'gcp-us-west4', populateMemList: () => Promise.resolve() });
		({ getTestServer, addFakeProbe, deleteFakeProbe } = await import('../../../utils/server.js'));
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
					measurementOptions: {
						packets: 4,
					},
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
			await deleteFakeProbe(probe);
			nock.cleanAll();
		});

		it('should respond with error if there are no ready probes', async () => {
			probe.emit('probe:status:update', 'initializing');

			await requestAgent.post('/v1/measurements')
				.send({
					type: 'ping',
					target: 'example.com',
					locations: [{ country: 'US' }],
					measurementOptions: {
						packets: 4,
					},
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
					measurementOptions: {
						packets: 4,
					},
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

		it('should create measurement with global limit', async () => {
			await requestAgent.post('/v1/measurements')
				.send({
					type: 'ping',
					target: 'example.com',
					locations: [{ country: 'US' }],
					measurementOptions: {
						packets: 4,
					},
					limit: 2,
				})
				.expect(202)
				.expect((response) => {
					expect(response.body.id).to.exist;
					expect(response.header.location).to.exist;
					expect(response.body.probesCount).to.equal(1);
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
					expect(response.header.location).to.exist;
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
					expect(response.header.location).to.exist;
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
					measurementOptions: {
						packets: 4,
					},
				})
				.expect(202)
				.expect((response) => {
					expect(response.body.id).to.exist;
					expect(response.header.location).to.exist;
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
					expect(response.header.location).to.exist;
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
					expect(response.header.location).to.exist;
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
					expect(response.header.location).to.exist;
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
					expect(response.header.location).to.exist;
					expect(response.body.probesCount).to.equal(1);
					expect(response).to.matchApiSchema();
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
				.expect((response) => {
					expect(response.body.id).to.exist;
					expect(response.header.location).to.exist;
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
					measurementOptions: {
						packets: 4,
					},
				})
				.expect(202)
				.expect((response) => {
					expect(response.body.id).to.exist;
					expect(response.header.location).to.exist;
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
					measurementOptions: {
						packets: 4,
					},
				})
				.expect(202)
				.expect((response) => {
					expect(response.body.id).to.exist;
					expect(response.header.location).to.exist;
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
					measurementOptions: {
						packets: 4,
					},
				})
				.expect(202)
				.expect((response) => {
					expect(response.body.id).to.exist;
					expect(response.header.location).to.exist;
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
					measurementOptions: {
						packets: 4,
					},
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
					measurementOptions: {
						packets: 4,
					},
				})
				.expect(202)
				.expect((response) => {
					expect(response.body.id).to.exist;
					expect(response.header.location).to.exist;
					expect(response.body.probesCount).to.equal(1);
					expect(response).to.matchApiSchema();
				});
		});

		describe('adopted probes', () => {
			before(async () => {
				await client(ADOPTED_PROBES_TABLE).insert({
					userId: '1834071',
					lastSyncDate: new Date(),
					ip: '1.2.3.4',
					uuid: '1-1-1-1-1',
					isCustomCity: 1,
					tags: '["dashboard_tag"]',
					status: 'ready',
					version: '0.26.0',
					country: 'US',
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
						measurementOptions: {
							packets: 4,
						},
					})
					.expect(202)
					.expect((response) => {
						expect(response.body.id).to.exist;
						expect(response.header.location).to.exist;
						expect(response.body.probesCount).to.equal(1);
						expect(response).to.matchApiSchema();
					});
			});

			it('should create measurement with adopted "tags: ["u-jimaek-dashboard_tag"]" location', async () => {
				await requestAgent.post('/v1/measurements')
					.send({
						type: 'ping',
						target: 'example.com',
						locations: [{ tags: [ 'u-jimaek-dashboard_tag' ], limit: 2 }],
						measurementOptions: {
							packets: 4,
						},
					})
					.expect(202)
					.expect((response) => {
						expect(response.body.id).to.exist;
						expect(response.header.location).to.exist;
						expect(response.body.probesCount).to.equal(1);
						expect(response).to.matchApiSchema();
					});
			});
		});
	});
});
