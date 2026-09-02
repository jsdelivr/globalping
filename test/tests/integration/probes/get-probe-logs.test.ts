import { type Agent } from 'supertest';
import { getTestServer, getIoContext } from '../../../utils/server.js';
import request from 'supertest';
import config from 'config';
import type { AuthenticateOptions } from '../../../../src/lib/http/middleware/authenticate.js';
import { JWTPayload, SignJWT } from 'jose';
import * as redis from '../../../../src/lib/redis/measurement-client.js';
import * as sinon from 'sinon';
import { Adoption } from '../../../../src/lib/override/adopted-probes.js';
import { expect } from 'chai';
import { RedisCluster } from '../../../../src/lib/redis/shared.js';
import { dashboardClient } from '../../../../src/lib/sql/client.js';
import { createOrg, createUser } from '../../../utils/fixtures.js';

const sessionConfig = config.get<AuthenticateOptions['session']>('server.session');

describe('Get Probe Logs', () => {
	let requestAgent: Agent;
	let sessionKey: Buffer;
	let sandbox: sinon.SinonSandbox;
	let client: RedisCluster;

	const PROBE_ID = 'mock-probe-id';
	const PROBE_UUID = 'mock-probe-uuid';
	const REDIS_LOG_KEY = 'probe:mock-probe-uuid:logs';

	let user: { id: string; accountId: string };
	let viewerOrg: { id: string; accountId: string };
	let mockAdoption: Adoption;

	const redisLogs = [
		{
			id: '1705917173113-0',
			message: {
				message: 'log message 1',
				timestamp: '2025-01-01T00:00:00.000Z',
				level: 'info',
				scope: 'system',
			},
		},
		{
			id: '1705917173123-0',
			message: {
				message: 'log message 2',
				timestamp: '2025-01-01T00:00:10.000Z',
				level: 'warn',
				scope: 'system',
			},
		},
	];

	const getSignedJwt = (options: JWTPayload) => {
		return new SignJWT(options).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(sessionKey);
	};

	before(async () => {
		user = await createUser(dashboardClient);
		viewerOrg = await createOrg(dashboardClient, { members: [{ userId: user.id, role: 'viewer' }] });
		mockAdoption = { id: PROBE_ID, uuid: PROBE_UUID, accountId: user.accountId } as Adoption;

		sessionKey = Buffer.from(sessionConfig.cookieSecret);
		const app = await getTestServer();
		requestAgent = request(app);

		client = redis.getMeasurementRedisClient();
		const redisKey = REDIS_LOG_KEY;

		await client.del(REDIS_LOG_KEY);

		for (const entry of redisLogs) {
			await client.xAdd(redisKey, entry.id, entry.message);
		}
	});

	after(async () => {
		await client.del(REDIS_LOG_KEY);
	});

	beforeEach(async () => {
		sandbox = sinon.createSandbox();
	});

	afterEach(async () => {
		sandbox.restore();
	});

	it('should respond with 404 if user is not authorized', async () => {
		sandbox.stub(getIoContext().adoptedProbes, 'getById').returns(mockAdoption);
		await requestAgent.get(`/v1/probes/${PROBE_ID}/logs`).send().expect(404);
	});

	it('should respond with 404 if user is admin and probe does not exist', async () => {
		sandbox.stub(getIoContext().adoptedProbes, 'getById').returns(null);
		const jwt = await getSignedJwt({ id: 'admin-user-id', admin_access: true, app_access: true });

		await requestAgent.get(`/v1/probes/nonexistent/logs`).set('Cookie', `${sessionConfig.cookieName}=${jwt}`).send().expect(404);
	});

	it('should respond with 200 if user is admin and probe exists', async () => {
		sandbox.stub(getIoContext().adoptedProbes, 'getById').returns(mockAdoption);
		const jwt = await getSignedJwt({ id: 'admin-user-id', admin_access: true, app_access: true });

		await requestAgent.get(`/v1/probes/${PROBE_ID}/logs`).set('Cookie', `${sessionConfig.cookieName}=${jwt}`).send().expect(200);
	});

	it('should respond with 200 if user is an owner of an existing probe', async () => {
		sandbox.stub(getIoContext().adoptedProbes, 'getById').returns(mockAdoption);
		const jwt = await getSignedJwt({ id: user.id, app_access: true });

		await requestAgent.get(`/v1/probes/${PROBE_ID}/logs`).set('Cookie', `${sessionConfig.cookieName}=${jwt}`).send().expect(200);
	});

	it('should respond with 200 if the user is a viewer of the org owning the probe', async () => {
		sandbox.stub(getIoContext().adoptedProbes, 'getById').returns({ ...mockAdoption, accountId: viewerOrg.accountId });
		const jwt = await getSignedJwt({ id: user.id, app_access: true, user_account_id: user.accountId });

		await requestAgent.get(`/v1/probes/${PROBE_ID}/logs`)
			.set('Cookie', `${sessionConfig.cookieName}=${jwt}; ${sessionConfig.activeAccountCookieName}=${viewerOrg.accountId}`)
			.send()
			.expect(200);
	});

	it('should return logs in the expected format', async () => {
		sandbox.stub(getIoContext().adoptedProbes, 'getById').returns(mockAdoption);
		const jwt = await getSignedJwt({ id: 'admin-user-id', admin_access: true, app_access: true });

		await requestAgent
			.get(`/v1/probes/${PROBE_ID}/logs`)
			.set('Cookie', `${sessionConfig.cookieName}=${jwt}`)
			.send()
			.expect(200)
			.expect((response) => {
				expect(response.body).to.deep.equal({ logs: redisLogs.map(entry => entry.message), lastId: redisLogs[1]!.id });
			});
	});

	it('should respect the after query parameter', async () => {
		sandbox.stub(getIoContext().adoptedProbes, 'getById').returns(mockAdoption);
		const jwt = await getSignedJwt({ id: user.id, app_access: true });

		await requestAgent
			.get(`/v1/probes/${PROBE_ID}/logs?after=1705917173120-0`)
			.set('Cookie', `${sessionConfig.cookieName}=${jwt}`)
			.send()
			.expect(200)
			.expect((response) => {
				expect(response.body.logs).to.deep.equal([ redisLogs[1]!.message ]);
			});
	});

	it('should return all logs if after is -', async () => {
		sandbox.stub(getIoContext().adoptedProbes, 'getById').returns(mockAdoption);
		const jwt = await getSignedJwt({ id: 'admin-user-id', admin_access: true, app_access: true });

		await requestAgent
			.get(`/v1/probes/${PROBE_ID}/logs?after=-`)
			.set('Cookie', `${sessionConfig.cookieName}=${jwt}`)
			.send()
			.expect(200)
			.expect((response) => {
				expect(response.body).to.deep.equal({ logs: redisLogs.map(entry => entry.message), lastId: redisLogs[1]!.id });
			});
	});

	it('should reject invalid after query parameter', async () => {
		sandbox.stub(getIoContext().adoptedProbes, 'getById').returns(mockAdoption);
		const jwt = await getSignedJwt({ id: user.id, app_access: true });

		await requestAgent
			.get(`/v1/probes/${PROBE_ID}/logs?after=foo`)
			.set('Cookie', `${sessionConfig.cookieName}=${jwt}`)
			.send()
			.expect(400);
	});
});
