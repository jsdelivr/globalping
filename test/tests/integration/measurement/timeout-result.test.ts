import request, { type SuperTest, type Test } from 'supertest';
import * as td from 'testdouble';
import nock from 'nock';
import type { Socket } from 'socket.io-client';
import * as sinon from 'sinon';
import { expect } from 'chai';
import nockGeoIpProviders from '../../../utils/nock-geo-ip.js';

describe('Timeout results', () => {
	let probe: Socket;
	let addFakeProbe: (events?: Record<string, any>) => Promise<Socket>;
	let deleteFakeProbe: (socket: Socket) => Promise<void>;
	let getTestServer;
	let requestAgent: SuperTest<Test>;
	let sandbox: sinon.SinonSandbox;

	const cryptoRandomString = sinon.stub().returns('measurementid');

	before(async () => {
		sandbox = sinon.createSandbox({ useFakeTimers: { shouldAdvanceTime: true } });
		await td.replaceEsm('crypto-random-string', {}, cryptoRandomString);
		await td.replaceEsm('../../../../src/lib/ip-ranges.ts', { getRegion: () => 'gcp-us-west4', populateMemList: () => Promise.resolve() });
		({ getTestServer, addFakeProbe, deleteFakeProbe } = await import('../../../utils/server.js'));
		const app = await getTestServer();
		requestAgent = request(app);
	});

	beforeEach(async () => {
		nockGeoIpProviders();

		probe = await addFakeProbe();
	});

	afterEach(async () => {
		await deleteFakeProbe(probe);
		nock.cleanAll();
	});

	after(() => {
		td.reset();
		sandbox.restore();
	});

	it('should be included in measurement if there was no ack or results from the probe', async () => {
		probe.emit('probe:status:update', 'ready');

		await requestAgent.post('/v1/measurements').send({
			type: 'ping',
			target: 'jsdelivr.com',
			locations: [{ country: 'US' }],
			measurementOptions: {
				packets: 4,
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
					results: [
						{
							probe: {
								continent: 'NA',
								region: 'Northern America',
								country: 'US',
								state: 'TX',
								city: 'Dallas',
								asn: 20004,
								longitude: -96.8067,
								latitude: 32.7831,
								network: 'The Constant Company LLC',
								tags: [ 'gcp-us-west4', 'datacenter-network' ],
								resolvers: [],
							},
							result: { status: 'in-progress', rawOutput: '' },
						},
					],
				});

				expect(response).to.matchApiSchema();
			});

		await sandbox.clock.tickAsync(60000); // cleanup interval + time to treat measurement as timed out

		for (let i = 0; i < 10; i++) { // need to wait for a few additional event loop cycles, so redis update will be finished
			await sandbox.clock.nextAsync();
		}

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
								longitude: -96.8067,
								latitude: 32.7831,
								network: 'The Constant Company LLC',
								tags: [ 'gcp-us-west4', 'datacenter-network' ],
								resolvers: [],
							},
							result: { status: 'failed', rawOutput: '\n\nThe measurement timed out' },
						},
					],
				});

				expect(response).to.matchApiSchema();
			});
	});
});
