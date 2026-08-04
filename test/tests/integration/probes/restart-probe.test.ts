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

const sessionConfig = config.get<AuthenticateOptions['session']>('server.session');

describe('Restart Probe', () => {
	let requestAgent: Agent;
	let sessionKey: Buffer;
	let sandbox: sinon.SinonSandbox;
	let probe: Socket | undefined;

	const PROBE_ID = 'mock-probe-id';
	const PROBE_UUID = '22222222-2222-4222-8222-222222222222';
	const PROBE_USER_ID = 'mock-u-1';

	const mockAdoption = {
		id: PROBE_ID,
		uuid: PROBE_UUID,
		userId: PROBE_USER_ID,
	} as Adoption;

	const getSignedJwt = (options: JWTPayload) => {
		return new SignJWT(options).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(sessionKey);
	};

	before(async () => {
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

	it('should respond with 404 if user is not authorized', async () => {
		sandbox.stub(getIoContext().adoptedProbes, 'getById').returns(mockAdoption);

		await requestAgent.post(`/v1/probes/${PROBE_ID}/restart`).send().expect(404);
	});

	it('should respond with 404 if user is admin and probe does not exist', async () => {
		sandbox.stub(getIoContext().adoptedProbes, 'getById').returns(null);
		const jwt = await getSignedJwt({ id: 'admin-user-id', admin_access: true, app_access: true });

		await requestAgent.post('/v1/probes/nonexistent/restart').set('Cookie', `${sessionConfig.cookieName}=${jwt}`).send().expect(404);
	});

	it('should respond with 404 if probe is offline', async () => {
		sandbox.stub(getIoContext().adoptedProbes, 'getById').returns(mockAdoption);
		const jwt = await getSignedJwt({ id: PROBE_USER_ID, app_access: true });

		await requestAgent.post(`/v1/probes/${PROBE_ID}/restart`).set('Cookie', `${sessionConfig.cookieName}=${jwt}`).send().expect(404);
	});

	it('should restart an existing probe for its owner', async () => {
		sandbox.stub(getIoContext().adoptedProbes, 'getById').returns(mockAdoption);
		nockGeoIpProviders();
		probe = await addFakeProbe({}, { query: { uuid: PROBE_UUID } });
		const restartSignal = new Promise<void>(resolve => probe!.once('probe:sigkill', resolve));
		const jwt = await getSignedJwt({ id: PROBE_USER_ID, app_access: true });

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
