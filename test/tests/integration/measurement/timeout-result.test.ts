import fs from 'node:fs';
import request, { type SuperTest, type Test } from 'supertest';
import * as td from 'testdouble';
import nock from 'nock';
import type { Socket } from 'socket.io-client';
import * as sinon from 'sinon';
import { expect } from 'chai';

const nockMocks = JSON.parse(fs.readFileSync('./test/mocks/nock-geoip.json').toString()) as Record<string, any>;

describe('Timeout results', () => {
	let probe: Socket;
	let addFakeProbe: (events?: Record<string, any>) => Promise<Socket>;
	let deleteFakeProbe: (socket: Socket) => Promise<void>;
	let getTestServer;
	let requestAgent: SuperTest<Test>;
	let sandbox: sinon.SinonSandbox;

	const cryptoRandomString = sinon.stub().returns('measurementid');

	before(async () => {
		sandbox = sinon.createSandbox({ useFakeTimers: true });
		await td.replaceEsm('@jcoreio/async-throttle', null, (f: any) => f);
		await td.replaceEsm('crypto-random-string', {}, cryptoRandomString);
		await td.replaceEsm('../../../../src/lib/ip-ranges.ts', { getRegion: () => 'gcp-us-west4', populateMemList: () => Promise.resolve() });
		({ getTestServer, addFakeProbe, deleteFakeProbe } = await import('../../../utils/server.js'));
		const app = await getTestServer();
		requestAgent = request(app);
	});

	beforeEach(async () => {
		nock('https://globalping-geoip.global.ssl.fastly.net').get(/.*/).reply(200, nockMocks['01.00'].fastly);
		nock('https://ipinfo.io').get(/.*/).reply(200, nockMocks['01.00'].ipinfo);
		nock('https://geoip.maxmind.com/geoip/v2.1/city/').get(/.*/).reply(200, nockMocks['01.00'].maxmind);

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
					probesCount: 1,
					results: [
						{
							probe: {
								continent: 'NA',
								region: 'Northern America',
								country: 'US',
								state: 'TX',
								city: 'Dallas',
								asn: 123,
								longitude: -96.8389,
								latitude: 32.7492,
								network: 'Psychz Networks',
								tags: [ 'gcp-us-west4' ],
								resolvers: [],
							},
							result: { status: 'in-progress', rawOutput: '' },
						},
					],
				});
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
					probesCount: 1,
					results: [{
						probe: {
							asn: 123,
							city: 'Dallas',
							continent: 'NA',
							country: 'US',
							latitude: 32.7492,
							longitude: -96.8389,
							network: 'Psychz Networks',
							region: 'Northern America',
							resolvers: [],
							state: 'TX',
							tags: [ 'gcp-us-west4' ],
						},
						result: {
							rawOutput: '\n\nThe measurement timed out',
							status: 'failed',
						},
					}],
				});
			});
	});
});
