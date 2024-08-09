import type { Server } from 'node:http';
import nock from 'nock';
import * as sinon from 'sinon';
import request, { type Agent } from 'supertest';
import { getTestServer, addFakeProbe, deleteFakeProbes, waitForProbesUpdate } from '../../utils/server.js';
import nockGeoIpProviders from '../../utils/nock-geo-ip.js';
import { expect } from 'chai';

describe('Adoption code', () => {
	let app: Server;
	let requestAgent: Agent;

	const sandbox = sinon.createSandbox();

	before(async () => {
		app = await getTestServer();
		requestAgent = request(app);
	});

	afterEach(async () => {
		sandbox.resetHistory();
		await deleteFakeProbes();
	});

	after(async () => {
		nock.cleanAll();
		await deleteFakeProbes();
	});

	it('should add alternative ip to the probe', async () => {
		nockGeoIpProviders();

		let token: string | undefined;
		let socketId: string | undefined;

		const probe = await addFakeProbe({
			'api:connect:alt-ips-token': (data: { token: string, socketId: string }) => {
				token = data.token;
				socketId = data.socketId;
			},
		});

		probe.emit('probe:status:update', 'ready');

		await requestAgent.post('/v1/alternative-ip')
			.send({ socketId, token })
			.expect(200);

		await waitForProbesUpdate();

		await requestAgent.get('/v1/probes?adminkey=admin')
			.send()
			.expect(200)
			.expect((response) => {
				expect(response.body[0].altIpAddresses.length).to.equal(1);
			});
	});

	it('should not add duplicate alternative ips to the probe', async () => {
		nockGeoIpProviders();

		let token: string | undefined;
		let socketId: string | undefined;

		const probe = await addFakeProbe({
			'api:connect:alt-ips-token': (data: { token: string, socketId: string }) => {
				token = data.token;
				socketId = data.socketId;
			},
		});

		probe.emit('probe:status:update', 'ready');

		await requestAgent.post('/v1/alternative-ip')
			.send({ socketId, token })
			.expect(200);

		await requestAgent.post('/v1/alternative-ip')
			.send({ socketId, token })
			.expect(200);

		await waitForProbesUpdate();

		await requestAgent.get('/v1/probes?adminkey=admin')
			.send()
			.expect(200)
			.expect((response) => {
				expect(response.body[0].altIpAddresses.length).to.equal(1);
			});
	});

	it('should send 400 if token is invalid', async () => {
		nockGeoIpProviders();

		let socketId: string | undefined;

		await addFakeProbe({
			'api:connect:alt-ips-token': (data: { token: string, socketId: string }) => {
				socketId = data.socketId;
			},
		});

		await requestAgent.post('/v1/alternative-ip')
			.send({ socketId, token: 'fake-token-012345678901234567890' })
			.expect(400)
			.expect((response) => {
				expect(response.body.error.type).to.equal('wrong_token');
			});
	});

	it('should send 400 if socket not found', async () => {
		nockGeoIpProviders();

		let token: string | undefined;
		let socketId: string | undefined;

		await addFakeProbe({
			'api:connect:alt-ips-token': () => {
				token = 'fake-token-012345678901234567890';
				socketId = 'fake-socket-12345678';
			},
		});

		await requestAgent.post('/v1/alternative-ip')
			.send({ socketId, token })
			.expect(400)
			.expect((response) => {
				expect(response.body.error.type).to.equal('probe_not_found');
			});
	});
});
