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

	before(async () => {
		app = await getTestServer();
		requestAgent = request(app);
	});

	beforeEach(async () => {
		sandbox.resetHistory();
		await deleteFakeProbes();
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

		const cb = sandbox.stub();
		probe.emit('probe:alt-ips', {
			[ip]: token,
		}, cb);

		await waitForProbesUpdate();

		await requestAgent.get('/v1/probes?adminkey=admin')
			.send()
			.expect(200)
			.expect((response) => {
				expect(response.body[0].altIpAddresses.length).to.equal(1);
			});

		expect(cb.callCount).to.equal(1);
		expect(cb.args[0]![0]).to.deep.equal({ addedAltIps: [ ip ], rejectedAltIps: [] });
	});

	it('should not add duplicate alternative ips to the probe', async () => {
		nockGeoIpProviders();
		const probe = await addFakeProbe();

		const { body: { ip, token } } = await requestAgent.post('/v1/alternative-ip')
			.send()
			.set('X-Forwarded-For', '89.64.80.78')
			.expect(200);

		probe.emit('probe:status:update', 'ready');

		nockGeoIpProviders();

		const cb1 = sandbox.stub();
		probe.emit('probe:alt-ips', {
			[ip]: token,
		}, cb1);

		nockGeoIpProviders();

		const cb2 = sandbox.stub();
		probe.emit('probe:alt-ips', {
			[ip]: token,
		}, cb2);

		await waitForProbesUpdate();

		await requestAgent.get('/v1/probes?adminkey=admin')
			.send()
			.expect(200)
			.expect((response) => {
				expect(response.body[0].altIpAddresses.length).to.equal(1);
			});

		expect(cb1.callCount).to.equal(1);
		expect(cb1.args[0]![0]).to.deep.equal({ addedAltIps: [ ip ], rejectedAltIps: [] });
		expect(cb2.callCount).to.equal(1);
		expect(cb2.args[0]![0]).to.deep.equal({ addedAltIps: [ ip ], rejectedAltIps: [] });
	});

	it('should reject alt ip with invalid token', async () => {
		nockGeoIpProviders();
		const probe = await addFakeProbe();

		probe.emit('probe:status:update', 'ready');

		const cb = sandbox.stub();
		probe.emit('probe:alt-ips', {
			'89.64.80.78': 'invalid-token-123456789012345678',
		}, cb);

		await waitForProbesUpdate();

		await requestAgent.get('/v1/probes?adminkey=admin')
			.send()
			.expect(200)
			.expect((response) => {
				expect(response.body[0].altIpAddresses.length).to.equal(0);
			});

		expect(cb.callCount).to.equal(1);
		expect(cb.args[0]![0]).to.deep.equal({ addedAltIps: [], rejectedAltIps: [ '89.64.80.78' ] });
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

		const cb = sandbox.stub();
		probe.emit('probe:alt-ips', {
			'1.2.3.4': token,
		}, cb);

		await waitForProbesUpdate();

		await requestAgent.get('/v1/probes?adminkey=admin')
			.send()
			.expect(200)
			.expect((response) => {
				expect(response.body[0].altIpAddresses.length).to.equal(0);
			});

		expect(cb.callCount).to.equal(1);
		expect(cb.args[0]![0]).to.deep.equal({ addedAltIps: [], rejectedAltIps: [ '1.2.3.4' ] });
	});
});
