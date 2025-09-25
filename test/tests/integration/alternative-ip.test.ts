import type { Server } from 'node:http';
import nock from 'nock';
import * as sinon from 'sinon';
import request, { type Agent } from 'supertest';
import { getTestServer, addFakeProbe, deleteFakeProbes, waitForProbesUpdate } from '../../utils/server.js';
import nockGeoIpProviders from '../../utils/nock-geo-ip.js';
import { expect } from 'chai';

describe('Alternative IPs', () => {
	let app: Server;
	let requestAgent: Agent;

	const sandbox = sinon.createSandbox();
	const ack = sandbox.stub();

	before(async () => {
		app = await getTestServer();
		requestAgent = request(app);
	});

	beforeEach(async () => {
		sandbox.resetHistory();
		await deleteFakeProbes();
		ack.reset();
	});

	after(async () => {
		nock.cleanAll();
		await deleteFakeProbes();
	});

	it('should add alternative ip to the probe', async () => {
		nockGeoIpProviders();
		const probe = await addFakeProbe();

		const { body: { ip, token } } = await requestAgent.post('/v1/alternative-ip')
			.send()
			.set('X-Forwarded-For', '89.64.80.78')
			.expect(200);

		probe.emit('probe:status:update', 'ready');

		nockGeoIpProviders();

		probe.emit('probe:alt-ips', [ [ ip, token ] ], ack);

		await waitForProbesUpdate();

		await requestAgent.get('/v1/probes?adminkey=admin')
			.send()
			.expect(200)
			.expect((response) => {
				expect(response.body[0].altIpAddresses.length).to.equal(1);
			});

		expect(ack.callCount).to.equal(1);
		expect(ack.args[0]![0]).to.deep.equal({ addedAltIps: [ ip ], rejectedIpsToResons: {} });
	});

	it('should be able to remove alt ips from the probe', async () => {
		nockGeoIpProviders();
		const probe = await addFakeProbe();

		const { body: { ip, token } } = await requestAgent.post('/v1/alternative-ip')
			.send()
			.set('X-Forwarded-For', '89.64.80.78')
			.expect(200);

		probe.emit('probe:status:update', 'ready');

		nockGeoIpProviders();

		probe.emit('probe:alt-ips', [ [ ip, token ] ], ack);

		await waitForProbesUpdate();

		await requestAgent.get('/v1/probes?adminkey=admin')
			.send()
			.expect(200)
			.expect((response) => {
				expect(response.body[0].altIpAddresses.length).to.equal(1);
			});

		probe.emit('probe:alt-ips', [], ack);

		await waitForProbesUpdate();

		await requestAgent.get('/v1/probes?adminkey=admin')
			.send()
			.expect(200)
			.expect((response) => {
				expect(response.body[0].altIpAddresses.length).to.equal(0);
			});

		expect(ack.callCount).to.equal(2);
		expect(ack.args[0]![0]).to.deep.equal({ addedAltIps: [ ip ], rejectedIpsToResons: {} });
		expect(ack.args[1]![0]).to.deep.equal({ addedAltIps: [], rejectedIpsToResons: {} });
	});

	it('should reject alt ip with invalid token', async () => {
		nockGeoIpProviders();
		const probe = await addFakeProbe();

		probe.emit('probe:status:update', 'ready');

		probe.emit('probe:alt-ips', [ [ '89.64.80.78', 'invalid-token-123456789012345678' ] ], ack);

		await waitForProbesUpdate();

		await requestAgent.get('/v1/probes?adminkey=admin')
			.send()
			.expect(200)
			.expect((response) => {
				expect(response.body[0].altIpAddresses.length).to.equal(0);
			});

		expect(ack.callCount).to.equal(1);
		expect(ack.args[0]![0]).to.deep.equal({ addedAltIps: [], rejectedIpsToResons: { '89.64.80.78': 'Invalid alt IP token.' } });
	});

	it('should reject alt ip with token for different ip', async () => {
		nockGeoIpProviders();
		const probe = await addFakeProbe();

		const { body: { token } } = await requestAgent.post('/v1/alternative-ip')
			.send()
			.set('X-Forwarded-For', '89.64.80.78')
			.expect(200);

		probe.emit('probe:status:update', 'ready');

		nockGeoIpProviders();

		probe.emit('probe:alt-ips', [ [ '1.2.3.4', token ] ], ack);

		await waitForProbesUpdate();

		await requestAgent.get('/v1/probes?adminkey=admin')
			.send()
			.expect(200)
			.expect((response) => {
				expect(response.body[0].altIpAddresses.length).to.equal(0);
			});

		expect(ack.callCount).to.equal(1);
		expect(ack.args[0]![0]).to.deep.equal({ addedAltIps: [], rejectedIpsToResons: { '1.2.3.4': 'Invalid alt IP token.' } });
	});
});
