import config from 'config';
import type { JWTPayload } from 'jose';
import { SignJWT } from 'jose';
import request, { type Agent } from 'supertest';
import * as sinon from 'sinon';
import type { Socket } from 'socket.io-client';
import type { AuthenticateOptions } from '../../../../src/lib/http/middleware/authenticate.js';
import type { Adoption } from '../../../../src/lib/override/adopted-probes.js';
import { addFakeProbe, deleteFakeProbes, getIoContext, getTestServer } from '../../../utils/server.js';
import nockGeoIpProviders from '../../../utils/nock-geo-ip.js';
import { dashboardClient } from '../../../../src/lib/sql/client.js';
import { createOrg, createUser } from '../../../utils/fixtures.js';

const sessionConfig = config.get<AuthenticateOptions['session']>('server.session');

describe('Restart Probe', () => {
	let requestAgent: Agent;
	let sessionKey: Buffer;
	let sandbox: sinon.SinonSandbox;
	let probe: Socket | undefined;

	const PROBE_ID = 'mock-probe-id';
	const PROBE_UUID = '22222222-2222-4222-8222-222222222222';

	let user: { id: string; accountId: string };
	let viewerOrg: { id: string; accountId: string };
	let mockAdoption: Adoption;

	const getSignedJwt = (options: JWTPayload) => {
		return new SignJWT(options).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(sessionKey);
	};

	before(async () => {
		user = await createUser(dashboardClient);
		viewerOrg = await createOrg(dashboardClient, { members: [{ userId: user.id, role: 'viewer' }] });
		mockAdoption = { id: PROBE_ID, uuid: PROBE_UUID, accountId: user.accountId } as Adoption;

		sessionKey = Buffer.from(sessionConfig.cookieSecret);
		requestAgent = request(await getTestServer());
	});

	beforeEach(() => {
		sandbox = sinon.createSandbox();
	});

	afterEach(async () => {
		sandbox.restore();

		if (probe) {
			await deleteFakeProbes([ probe ]);
			probe = undefined;
		}
	});

	it('should respond with 404 if user does not own the probe', async () => {
		sandbox.stub(getIoContext().adoptedProbes, 'getById').returns(mockAdoption);
		nockGeoIpProviders();
		probe = await addFakeProbe({}, { query: { uuid: PROBE_UUID } });
		const jwt = await getSignedJwt({ id: 'other-user-id', app_access: true });

		await requestAgent.post(`/v1/probes/${PROBE_ID}/restart`).set('Cookie', `${sessionConfig.cookieName}=${jwt}`).send().expect(404);
	});

	it('should respond with 403 if the user is only a viewer of the org they act for', async () => {
		sandbox.stub(getIoContext().adoptedProbes, 'getById').returns(mockAdoption);
		const jwt = await getSignedJwt({ id: user.id, app_access: true, user_account_id: user.accountId });

		await requestAgent.post(`/v1/probes/${PROBE_ID}/restart`)
			.set('Cookie', `${sessionConfig.cookieName}=${jwt}; ${sessionConfig.activeAccountCookieName}=${viewerOrg.accountId}`)
			.send()
			.expect(403);
	});

	it('should respond with 404 if user is admin and probe does not exist', async () => {
		sandbox.stub(getIoContext().adoptedProbes, 'getById').returns(null);
		const jwt = await getSignedJwt({ id: 'admin-user-id', admin_access: true, app_access: true });

		await requestAgent.post('/v1/probes/nonexistent/restart').set('Cookie', `${sessionConfig.cookieName}=${jwt}`).send().expect(404);
	});

	it('should respond with 404 if probe is offline', async () => {
		sandbox.stub(getIoContext().adoptedProbes, 'getById').returns(mockAdoption);
		const jwt = await getSignedJwt({ id: user.id, app_access: true });

		await requestAgent.post(`/v1/probes/${PROBE_ID}/restart`).set('Cookie', `${sessionConfig.cookieName}=${jwt}`).send().expect(404);
	});

	it('should restart an existing probe for its owner', async () => {
		sandbox.stub(getIoContext().adoptedProbes, 'getById').returns(mockAdoption);
		nockGeoIpProviders();
		probe = await addFakeProbe({}, { query: { uuid: PROBE_UUID } });
		const restartSignal = new Promise<void>(resolve => probe!.once('probe:sigkill', resolve));
		const jwt = await getSignedJwt({ id: user.id, app_access: true });

		await requestAgent.post(`/v1/probes/${PROBE_ID}/restart`).set('Cookie', `${sessionConfig.cookieName}=${jwt}`).send().expect(204);
		await restartSignal;
	});

	it('should restart an existing probe for an admin', async () => {
		sandbox.stub(getIoContext().adoptedProbes, 'getById').returns(mockAdoption);
		nockGeoIpProviders();
		probe = await addFakeProbe({}, { query: { uuid: PROBE_UUID } });
		const restartSignal = new Promise<void>(resolve => probe!.once('probe:sigkill', resolve));
		const jwt = await getSignedJwt({ id: 'admin-user-id', admin_access: true, app_access: true });

		await requestAgent.post(`/v1/probes/${PROBE_ID}/restart`).set('Cookie', `${sessionConfig.cookieName}=${jwt}`).send().expect(204);
		await restartSignal;
	});
});
