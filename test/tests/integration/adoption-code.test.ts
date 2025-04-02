import type { Server } from 'node:http';
import { setTimeout } from 'node:timers/promises';
import nock from 'nock';
import { expect } from 'chai';
import * as sinon from 'sinon';
import request, { type Agent } from 'supertest';
import { getTestServer, addFakeProbe, deleteFakeProbes } from '../../utils/server.js';
import nockGeoIpProviders from '../../utils/nock-geo-ip.js';
import { getProbeByIp } from '../../../src/lib/ws/server.js';

describe('Adoption code', () => {
	let app: Server;
	let requestAgent: Agent;

	const sandbox = sinon.createSandbox();
	const adoptionCodeStub = sandbox.stub();
	const altIpTokenStub = sandbox.stub();

	before(async () => {
		app = await getTestServer();
		requestAgent = request(app);
		nockGeoIpProviders();

		await addFakeProbe({
			'probe:adoption:code': adoptionCodeStub,
			'api:connect:alt-ips-token': altIpTokenStub,
		});

		// Add alt IP to the probe.
		nockGeoIpProviders();
		const { token, socketId } = altIpTokenStub.args[0]![0];
		await requestAgent.post('/v1/alternative-ip')
			.set('X-Forwarded-For', '97.247.234.249')
			.send({
				token,
				socketId,
			});

		// Wait until alt IP is synced in synced-probe-list.ts.
		await getProbeByIp('97.247.234.249', { allowStale: false });
	});

	afterEach(async () => {
		sandbox.resetHistory();
	});

	after(async () => {
		nock.cleanAll();
		await deleteFakeProbes();
	});

	it('should send code to the probe', async () => {
		await requestAgent.post('/v1/adoption-code')
			.send({
				ip: '1.2.3.4',
				code: '123456',
			})
			.set('X-Api-Key', 'system')
			.expect(200).expect((response) => {
				expect(response.body).to.deep.equal({
					userId: null,
					ip: '1.2.3.4',
					name: null,
					altIps: [ '97.247.234.249' ],
					uuid: '1-1-1-1-1',
					tags: [],
					systemTags: [ 'datacenter-network' ],
					status: 'initializing',
					isIPv4Supported: false,
					isIPv6Supported: false,
					version: '0.14.0',
					nodeVersion: 'v18.17.0',
					hardwareDevice: null,
					hardwareDeviceFirmware: null,
					city: 'Dallas',
					state: 'TX',
					country: 'US',
					latitude: 32.78,
					longitude: -96.81,
					asn: 20004,
					network: 'The Constant Company LLC',
					adoptionToken: null,
					customLocation: null,
					allowedCountries: [ 'US' ],
				});
			});

		await setTimeout(20);
		expect(adoptionCodeStub.callCount).to.equal(1);
		expect(adoptionCodeStub.args[0]).to.deep.equal([{ code: '123456' }]);
	});

	it('should send code to the probe found by alt IP', async () => {
		await requestAgent.post('/v1/adoption-code')
			.send({
				ip: '97.247.234.249',
				code: '123456',
			})
			.set('X-Api-Key', 'system')
			.retry(100)
			.expect(200);

		await setTimeout(20);
		expect(adoptionCodeStub.callCount).to.equal(1);
		expect(adoptionCodeStub.args[0]).to.deep.equal([{ code: '123456' }]);
	});

	it('should return 403 for wrong system key', async () => {
		await requestAgent.post('/v1/adoption-code')
			.send({
				ip: '1.2.3.4',
				code: '123456',
			})
			.set('X-Api-Key', 'wrongkey')
			.expect(403).expect((response) => {
				expect(response.body.error.message).to.equal('Forbidden');
			});

		await setTimeout(20);
		expect(adoptionCodeStub.callCount).to.equal(0);
	});

	it('should return 422 if probe not found', async () => {
		await requestAgent.post('/v1/adoption-code')
			.send({
				ip: '9.9.9.9',
				code: '123456',
			})
			.set('X-Api-Key', 'system')
			.expect(422).expect((response) => {
				expect(response.body.error.message).to.equal('No matching probes found.');
			});

		expect(adoptionCodeStub.callCount).to.equal(0);
	});
});
