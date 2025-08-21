import { type Agent } from 'supertest';
import { getTestServer } from '../../../utils/server.js';
import request from 'supertest';
import config from 'config';
import type { AuthenticateOptions } from '../../../../src/lib/http/middleware/authenticate.js';
import { JWTPayload, SignJWT } from 'jose';
import * as redis from '../../../../src/lib/redis/measurement-client.js';
import * as sinon from 'sinon';
import { adoptedProbes } from '../../../../src/lib/ws/server.js';
import { Adoption } from '../../../../src/lib/override/adopted-probes.js';
import { expect } from 'chai';
import { RedisCluster } from '../../../../src/lib/redis/shared.js';
import { getRedisProbeLogKey } from '../../../../src/probe/handler/logs.js';

const sessionConfig = config.get<AuthenticateOptions['session']>('server.session');

describe('Get Probe Logs', () => {
	let requestAgent: Agent;
	let sessionKey: Buffer;
	let sandbox: sinon.SinonSandbox;
	let client: RedisCluster;

	const PROBE_ID = 'mock-probe';
	const PROBE_USER_ID = 'mock-u-1';

	const mockAdoption = {
		id: PROBE_ID,
		userId: PROBE_USER_ID,
	} as Adoption;

	const redisLogs = [
		{
			id: '1705917173113-0',
			message: {
				message: 'log message 1',
				timestamp: '2025-01-01T00:00:00.000Z',
				level: 'info',
				type: 'system',
			},
		},
		{
			id: '1705917173123-0',
			message: {
				message: 'log message 2',
				timestamp: '2025-01-01T00:00:10.000Z',
				level: 'warn',
				type: 'system',
			},
		},
	];

	const getSignedJwt = (options: JWTPayload) => {
		return new SignJWT(options).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(sessionKey);
	};

	before(async () => {
		sessionKey = Buffer.from(sessionConfig.cookieSecret);
		const app = await getTestServer();
		requestAgent = request(app);

		client = redis.getMeasurementRedisClient();
		const redisKey = getRedisProbeLogKey(PROBE_ID);

		for (const entry of redisLogs) {
			await client.xAdd(redisKey, entry.id, entry.message);
		}
	});

	after(async () => {
		await client.del(getRedisProbeLogKey(PROBE_ID));
	});

	beforeEach(async () => {
		sandbox = sinon.createSandbox();
	});

	afterEach(async () => {
		sandbox.restore();
	});

	it('should respond with 404 if user is not authorized', async () => {
		sandbox.stub(adoptedProbes, 'getById').returns(mockAdoption);
		await requestAgent.get(`/v1/probes/${PROBE_ID}/logs`).send().expect(404);
	});

	it('should respond with 404 if user is admin and probe does not exist', async () => {
		sandbox.stub(adoptedProbes, 'getById').returns(null);
		const jwt = await getSignedJwt({ id: 'admin-user-id', admin_access: true, app_access: true });

		await requestAgent.get(`/v1/probes/nonexistent/logs`).set('Cookie', `${sessionConfig.cookieName}=${jwt}`).send().expect(404);
	});

	it('should respond with 200 if user is admin and probe exists', async () => {
		sandbox.stub(adoptedProbes, 'getById').returns(mockAdoption);
		const jwt = await getSignedJwt({ id: 'admin-user-id', admin_access: true, app_access: true });

		await requestAgent.get(`/v1/probes/${PROBE_ID}/logs`).set('Cookie', `${sessionConfig.cookieName}=${jwt}`).send().expect(200);
	});

	it('should respond with 200 if user is an owner of an existing probe', async () => {
		sandbox.stub(adoptedProbes, 'getById').returns(mockAdoption);
		const jwt = await getSignedJwt({ id: PROBE_USER_ID, app_access: true });

		await requestAgent.get(`/v1/probes/${PROBE_ID}/logs`).set('Cookie', `${sessionConfig.cookieName}=${jwt}`).send().expect(200);
	});

	it('should return logs in the expected format', async () => {
		sandbox.stub(adoptedProbes, 'getById').returns(mockAdoption);
		const jwt = await getSignedJwt({ id: 'admin-user-id', admin_access: true, app_access: true });

		await requestAgent
			.get(`/v1/probes/${PROBE_ID}/logs`)
			.set('Cookie', `${sessionConfig.cookieName}=${jwt}`)
			.send()
			.expect(200)
			.expect((response) => {
				expect(response.body).to.deep.equal(redisLogs.map(entry => entry.message));
			});
	});

	it('should respect the since query parameter', async () => {
		sandbox.stub(adoptedProbes, 'getById').returns(mockAdoption);
		const jwt = await getSignedJwt({ id: PROBE_USER_ID, app_access: true });

		await requestAgent
			.get(`/v1/probes/${PROBE_ID}/logs?since=1705917173120`)
			.set('Cookie', `${sessionConfig.cookieName}=${jwt}`)
			.send()
			.expect(200)
			.expect((response) => {
				expect(response.body).to.deep.equal([ redisLogs[1]!.message ]);
			});
	});
});
