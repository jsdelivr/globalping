import request, { type Agent } from 'supertest';
import * as td from 'testdouble';
import nock from 'nock';
import type { Socket } from 'socket.io-client';
import * as sinon from 'sinon';
import { expect } from 'chai';
import nockGeoIpProviders from '../../../utils/nock-geo-ip.js';
import { waitForProbesUpdate } from '../../../utils/server.js';

describe('Timeout results', () => {
	let probe: Socket;
	let addFakeProbe: (events?: Record<string, any>) => Promise<Socket>;
	let deleteFakeProbes: () => Promise<void>;
	let getTestServer;
	let requestAgent: Agent;

	const sandbox = sinon.createSandbox();
	const cryptoRandomString = sandbox.stub().returns('measurementid');

	before(async () => {
		await td.replaceEsm('crypto-random-string', {}, cryptoRandomString);
		await td.replaceEsm('../../../../src/lib/ip-ranges.ts', { getRegion: () => 'gcp-us-west4', populateMemList: () => Promise.resolve() });
		({ getTestServer, addFakeProbe, deleteFakeProbes } = await import('../../../utils/server.js'));
		const app = await getTestServer();
		requestAgent = request(app);
	});

	beforeEach(async () => {
		nockGeoIpProviders();

		probe = await addFakeProbe();
	});

	afterEach(async () => {
		await deleteFakeProbes();
		nock.cleanAll();
	});

	after(() => {
		td.reset();
	});

	it('should be included in measurement if there was no ack or results from the probe', async () => {
		probe.emit('probe:status:update', 'ready');
		probe.emit('probe:isIPv4Supported:update', true);
		await waitForProbesUpdate();

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

		await clock.tickAsync(60000); // cleanup interval + time to treat measurement as timed out

		let response;

		do { // need to wait some time, so redis update will be finished
			response = await requestAgent.get('/v1/measurements/measurementid').send();
		} while (response.body.status === 'in-progress');

		expect(response.status).to.equal(200);

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
