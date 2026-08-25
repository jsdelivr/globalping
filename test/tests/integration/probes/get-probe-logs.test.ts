import { expect } from 'chai';
import config from 'config';
import { type JWTPayload, SignJWT } from 'jose';
import request, { type Agent } from 'supertest';
import * as sinon from 'sinon';
import type { AuthenticateOptions } from '../../../../src/lib/http/middleware/authenticate.js';
import type { Adoption } from '../../../../src/lib/override/adopted-probes.js';
import { timeSeriesClient } from '../../../../src/lib/sql/client.js';
import { getIoContext, getTestServer } from '../../../utils/server.js';

const sessionConfig = config.get<AuthenticateOptions['session']>('server.session');

describe('Get Probe Logs', () => {
	let requestAgent: Agent;
	let sessionKey: Buffer;
	let sandbox: sinon.SinonSandbox;
	let getByIdStub: sinon.SinonStub;

	const PROBE_ID = 'mock-probe-id';
	const PROBE_UUID = 'fb9756c9-a4d7-423f-9ed2-3b848e915159';
	const PROBE_USER_ID = 'mock-u-1';
	const mockAdoption = {
		id: PROBE_ID,
		uuid: PROBE_UUID,
		userId: PROBE_USER_ID,
	} as Adoption;

	const getSignedJwt = (options: JWTPayload) => new SignJWT(options)
		.setProtectedHeader({ alg: 'HS256' })
		.setIssuedAt()
		.setExpirationTime('1h')
		.sign(sessionKey);

	const insertLogs = async (logs: Array<{
		id: string;
		message: string;
		timestamp?: string | null;
		receivedAt?: Date | ReturnType<typeof timeSeriesClient.raw>;
		level?: string | null;
		scope?: string | null;
	}>) => timeSeriesClient('probe_log').insert(logs.map(log => ({
		probeUuid: PROBE_UUID,
		probeLogId: log.id,
		timestamp: log.timestamp === undefined ? '2026-08-15T10:00:00.000Z' : log.timestamp,
		receivedAt: log.receivedAt ?? new Date(),
		level: log.level === undefined ? 'info' : log.level,
		scope: log.scope === undefined ? 'system' : log.scope,
		message: log.message,
	})));

	before(async () => {
		sessionKey = Buffer.from(sessionConfig.cookieSecret);
		requestAgent = request(await getTestServer());
	});

	beforeEach(async () => {
		await timeSeriesClient('probe_log').delete();
		await timeSeriesClient('probe_log_counter').delete();
		sandbox = sinon.createSandbox();
		getByIdStub = sandbox.stub(getIoContext().adoptedProbes, 'getById').returns(mockAdoption);
	});

	afterEach(() => {
		sandbox.restore();
	});

	it('preserves owner-or-administrator authorization and nonexistent-probe behavior', async () => {
		await requestAgent.get(`/v1/probes/${PROBE_ID}/logs`).send().expect(404);

		const wrongOwnerJwt = await getSignedJwt({ id: 'other-user', app_access: true });
		await requestAgent.get(`/v1/probes/${PROBE_ID}/logs`)
			.set('Cookie', `${sessionConfig.cookieName}=${wrongOwnerJwt}`)
			.send()
			.expect(404);

		const ownerJwt = await getSignedJwt({ id: PROBE_USER_ID, app_access: true });
		await requestAgent.get(`/v1/probes/${PROBE_ID}/logs`)
			.set('Cookie', `${sessionConfig.cookieName}=${ownerJwt}`)
			.send()
			.expect(200)
			.expect({ logs: [], lastId: null, firstId: null, hasOlder: false });

		const adminJwt = await getSignedJwt({ id: 'admin-user', admin_access: true, app_access: true });
		await requestAgent.get(`/v1/probes/${PROBE_ID}/logs`)
			.set('Cookie', `${sessionConfig.cookieName}=${adminJwt}`)
			.send()
			.expect(200);

		getByIdStub.returns(null);

		await requestAgent.get('/v1/probes/nonexistent/logs')
			.set('Cookie', `${sessionConfig.cookieName}=${adminJwt}`)
			.send()
			.expect(404);
	});

	it('returns the newest 1,000 matching rows oldest-first when after is missing', async () => {
		await insertLogs(Array.from({ length: 1002 }, (_, index) => ({
			id: String(index + 1),
			message: `log ${index + 1}`,
			scope: index < 2 ? 'archive' : 'system',
		})));

		const jwt = await getSignedJwt({ id: PROBE_USER_ID, app_access: true });

		await requestAgent.get(`/v1/probes/${PROBE_ID}/logs`)
			.set('Cookie', `${sessionConfig.cookieName}=${jwt}`)
			.send()
			.expect(200)
			.expect((response) => {
				expect(response.body.logs).to.have.length(1000);

				expect(response.body.logs[0]).to.deep.equal({
					timestamp: '2026-08-15T10:00:00.000Z',
					level: 'info',
					scope: 'system',
					message: 'log 3',
				});

				expect(response.body.logs[999].message).to.equal('log 1002');
				expect(response.body.lastId).to.equal('1002');
				expect(response.body.firstId).to.equal('3');
				expect(response.body.hasOlder).to.equal(true);
			});

		await requestAgent.get(`/v1/probes/${PROBE_ID}/logs`)
			.query({ scopes: 'system' })
			.set('Cookie', `${sessionConfig.cookieName}=${jwt}`)
			.send()
			.expect(200)
			.expect((response) => {
				expect(response.body.logs).to.have.length(1000);
				expect(response.body.logs[0].message).to.equal('log 3');
				expect(response.body.firstId).to.equal('3');
				expect(response.body.hasOlder).to.equal(false);
			});
	});

	it('returns the newest incremental tail and preserves bigint cursor precision', async () => {
		const firstId = 9_007_199_254_740_993n;
		await insertLogs(Array.from({ length: 1002 }, (_, index) => ({
			id: (firstId + BigInt(index)).toString(),
			message: `log ${index + 1}`,
		})));

		const jwt = await getSignedJwt({ id: PROBE_USER_ID, app_access: true });
		const after = (firstId - 1n).toString();

		const firstResponse = await requestAgent.get(`/v1/probes/${PROBE_ID}/logs`)
			.query({ after })
			.set('Cookie', `${sessionConfig.cookieName}=${jwt}`)
			.send()
			.expect(200);
		expect(firstResponse.body.logs).to.have.length(1000);
		expect(firstResponse.body.logs[0].message).to.equal('log 3');
		expect(firstResponse.body.logs[999].message).to.equal('log 1002');
		expect(firstResponse.body.lastId).to.equal((firstId + 1001n).toString());
		expect(firstResponse.body.firstId).to.equal((firstId + 2n).toString());
		expect(firstResponse.body.hasOlder).to.equal(true);

		const historicalResponse = await requestAgent.get(`/v1/probes/${PROBE_ID}/logs`)
			.query({ after, before: (firstId + 1002n).toString() })
			.set('Cookie', `${sessionConfig.cookieName}=${jwt}`)
			.send()
			.expect(200);
		expect(historicalResponse.body.logs).to.have.length(1000);
		expect(historicalResponse.body.logs[0].message).to.equal('log 3');
		expect(historicalResponse.body.logs[999].message).to.equal('log 1002');
		expect(historicalResponse.body.lastId).to.equal(firstResponse.body.lastId);
		expect(historicalResponse.body.firstId).to.equal((firstId + 2n).toString());
		expect(historicalResponse.body.hasOlder).to.equal(true);

		const recoveryResponse = await requestAgent.get(`/v1/probes/${PROBE_ID}/logs`)
			.query({ after, before: historicalResponse.body.firstId })
			.set('Cookie', `${sessionConfig.cookieName}=${jwt}`)
			.send()
			.expect(200);
		expect(recoveryResponse.body.logs.map((log: { message: string }) => log.message)).to.deep.equal([ 'log 1', 'log 2' ]);
		expect(recoveryResponse.body.lastId).to.equal(firstResponse.body.lastId);
		expect(recoveryResponse.body.firstId).to.equal(firstId.toString());
		expect(recoveryResponse.body.hasOlder).to.equal(false);

		const exactLimitResponse = await requestAgent.get(`/v1/probes/${PROBE_ID}/logs`)
			.query({ after: (firstId + 1n).toString() })
			.set('Cookie', `${sessionConfig.cookieName}=${jwt}`)
			.send()
			.expect(200);
		expect(exactLimitResponse.body.logs).to.have.length(1000);
		expect(exactLimitResponse.body.logs[0].message).to.equal('log 3');
		expect(exactLimitResponse.body.firstId).to.equal((firstId + 2n).toString());
		expect(exactLimitResponse.body.hasOlder).to.equal(false);

		const secondResponse = await requestAgent.get(`/v1/probes/${PROBE_ID}/logs`)
			.query({ after: firstResponse.body.lastId })
			.set('Cookie', `${sessionConfig.cookieName}=${jwt}`)
			.send()
			.expect(200);
		expect(secondResponse.body).to.deep.equal({
			logs: [],
			lastId: firstResponse.body.lastId,
			firstId: null,
			hasOlder: false,
		});
	});

	it('advances an empty filtered result and never moves an incremental cursor backwards', async () => {
		await insertLogs([{ id: '1', message: 'first' }]);
		const jwt = await getSignedJwt({ id: PROBE_USER_ID, app_access: true });

		await requestAgent.get(`/v1/probes/${PROBE_ID}/logs`)
			.query({ search: 'missing' })
			.set('Cookie', `${sessionConfig.cookieName}=${jwt}`)
			.send()
			.expect(200)
			.expect({ logs: [], lastId: '1', firstId: null, hasOlder: false });

		await requestAgent.get(`/v1/probes/${PROBE_ID}/logs`)
			.query({ after: '2' })
			.set('Cookie', `${sessionConfig.cookieName}=${jwt}`)
			.send()
			.expect(200)
			.expect({ logs: [], lastId: '2', firstId: null, hasOlder: false });
	});

	it('filters multiple trimmed and de-duplicated scopes exactly and case-sensitively', async () => {
		await insertLogs([
			{ id: '1', message: 'system', scope: 'system' },
			{ id: '2', message: 'worker', scope: 'worker' },
			{ id: '3', message: 'api', scope: 'api:connect' },
			{ id: '4', message: 'case mismatch', scope: 'System' },
			{ id: '5', message: 'synthetic', timestamp: null, scope: null, level: null },
		]);

		const jwt = await getSignedJwt({ id: PROBE_USER_ID, app_access: true });

		const filtered = await requestAgent.get(`/v1/probes/${PROBE_ID}/logs`)
			.query({ scopes: ' system, worker,system,,api:connect, ' })
			.set('Cookie', `${sessionConfig.cookieName}=${jwt}`)
			.send()
			.expect(200);
		expect(filtered.body.logs.map((log: { message: string }) => log.message)).to.deep.equal([ 'system', 'worker', 'api' ]);
		expect(filtered.body.lastId).to.equal('5');

		const emptyFilter = await requestAgent.get(`/v1/probes/${PROBE_ID}/logs`)
			.query({ scopes: ', ,,' })
			.set('Cookie', `${sessionConfig.cookieName}=${jwt}`)
			.send()
			.expect(200);
		expect(emptyFilter.body.logs).to.have.length(5);

		expect(emptyFilter.body.logs[4]).to.deep.equal({
			timestamp: null,
			level: null,
			scope: null,
			message: 'synthetic',
		});

		const caseSensitive = await requestAgent.get(`/v1/probes/${PROBE_ID}/logs`)
			.query({ scopes: 'system' })
			.set('Cookie', `${sessionConfig.cookieName}=${jwt}`)
			.send()
			.expect(200);
		expect(caseSensitive.body.logs.map((log: { message: string }) => log.message)).to.deep.equal([ 'system' ]);
	});

	it('rejects any requested scope longer than 64 characters', async () => {
		const jwt = await getSignedJwt({ id: PROBE_USER_ID, app_access: true });
		await requestAgent.get(`/v1/probes/${PROBE_ID}/logs`)
			.query({ scopes: `system,${'s'.repeat(65)}` })
			.set('Cookie', `${sessionConfig.cookieName}=${jwt}`)
			.send()
			.expect(400);
	});

	it('searches case-insensitively and accepts one- and 128-character literal values', async () => {
		const longSearch = 'q'.repeat(128);
		await insertLogs([
			{ id: '1', message: 'MiXeDCaSe' },
			{ id: '2', message: 'Xylophone' },
			{ id: '3', message: `prefix ${longSearch} suffix` },
		]);

		const jwt = await getSignedJwt({ id: PROBE_USER_ID, app_access: true });

		const caseInsensitive = await requestAgent.get(`/v1/probes/${PROBE_ID}/logs`)
			.query({ search: 'mixedcase' })
			.set('Cookie', `${sessionConfig.cookieName}=${jwt}`)
			.send()
			.expect(200);
		expect(caseInsensitive.body.logs.map((log: { message: string }) => log.message)).to.deep.equal([ 'MiXeDCaSe' ]);

		const oneCharacter = await requestAgent.get(`/v1/probes/${PROBE_ID}/logs`)
			.query({ search: 'x' })
			.set('Cookie', `${sessionConfig.cookieName}=${jwt}`)
			.send()
			.expect(200);
		expect(oneCharacter.body.logs.map((log: { message: string }) => log.message)).to.deep.equal([ 'MiXeDCaSe', 'Xylophone', `prefix ${longSearch} suffix` ]);

		const maxLength = await requestAgent.get(`/v1/probes/${PROBE_ID}/logs`)
			.query({ search: longSearch })
			.set('Cookie', `${sessionConfig.cookieName}=${jwt}`)
			.send()
			.expect(200);
		expect(maxLength.body.logs.map((log: { message: string }) => log.message)).to.deep.equal([ `prefix ${longSearch} suffix` ]);

		const emptySearch = await requestAgent.get(`/v1/probes/${PROBE_ID}/logs`)
			.query({ search: '' })
			.set('Cookie', `${sessionConfig.cookieName}=${jwt}`)
			.send()
			.expect(200);
		expect(emptySearch.body.logs).to.have.length(3);

		await requestAgent.get(`/v1/probes/${PROBE_ID}/logs`)
			.query({ search: 'q'.repeat(129) })
			.set('Cookie', `${sessionConfig.cookieName}=${jwt}`)
			.send()
			.expect(400);
	});

	it('treats percent, underscore, and backslash search values as literal text', async () => {
		await insertLogs([
			{ id: '1', message: 'literal % percent' },
			{ id: '2', message: 'literal _ underscore' },
			{ id: '3', message: 'literal \\ backslash' },
			{ id: '4', message: 'plain text' },
		]);

		const jwt = await getSignedJwt({ id: PROBE_USER_ID, app_access: true });

		for (const [ search, expected ] of [
			[ '%', 'literal % percent' ],
			[ '_', 'literal _ underscore' ],
			[ '\\', 'literal \\ backslash' ],
		]) {
			const response = await requestAgent.get(`/v1/probes/${PROBE_ID}/logs`)
				.query({ search })
				.set('Cookie', `${sessionConfig.cookieName}=${jwt}`)
				.send()
				.expect(200);
			expect(response.body.logs.map((log: { message: string }) => log.message)).to.deep.equal([ expected ]);
		}
	});

	it('combines after, before, scope, search, UUID, and receivedAt conditions', async () => {
		await insertLogs([
			{ id: '1', message: 'needle before cursor', scope: 'worker' },
			{ id: '2', message: 'needle wrong scope', scope: 'system' },
			{ id: '3', message: 'needle match', scope: 'worker' },
			{ id: '4', message: 'needle at boundary', scope: 'worker' },
			{ id: '5', message: 'needle expired', scope: 'worker', receivedAt: timeSeriesClient.raw(`now() - interval '30 days 1 minute'`) },
		]);

		await timeSeriesClient('probe_log').insert({
			probeUuid: 'ddf25d5f-18e9-44bb-9845-f0be1b95f41a',
			probeLogId: '6',
			timestamp: '2026-08-15T10:00:00.000Z',
			receivedAt: new Date(),
			level: 'info',
			scope: 'worker',
			message: 'needle other probe',
		});

		const jwt = await getSignedJwt({ id: PROBE_USER_ID, app_access: true });

		const response = await requestAgent.get(`/v1/probes/${PROBE_ID}/logs`)
			.query({ after: '1', before: '4', scopes: 'worker', search: 'NEEDLE' })
			.set('Cookie', `${sessionConfig.cookieName}=${jwt}`)
			.send()
			.expect(200);

		const expiredLog = await timeSeriesClient('probe_log')
			.select('probeLogId')
			.where({ probeUuid: PROBE_UUID, probeLogId: '5' })
			.first();

		expect(expiredLog).to.exist;

		expect(response.body).to.deep.equal({
			logs: [{
				timestamp: '2026-08-15T10:00:00.000Z',
				level: 'info',
				scope: 'worker',
				message: 'needle match',
			}],
			lastId: '4',
			firstId: '3',
			hasOlder: false,
		});
	});

	it('rejects invalid log ID cursors and other invalid query parameters', async () => {
		const jwt = await getSignedJwt({ id: PROBE_USER_ID, app_access: true });

		for (const query of [{ after: '9223372036854775807' }, { before: '9223372036854775807' }]) {
			await requestAgent.get(`/v1/probes/${PROBE_ID}/logs`)
				.query(query)
				.set('Cookie', `${sessionConfig.cookieName}=${jwt}`)
				.send()
				.expect(200);
		}

		for (const query of [
			{ after: '9223372036854775808' },
			{ after: '-' },
			{ after: '1705917173120-0' },
			{ after: 'foo' },
			{ before: '9223372036854775808' },
			{ before: '-' },
			{ before: '1705917173120-0' },
			{ before: 'foo' },
			{ after: '2', before: '2' },
			{ after: '2', before: '1' },
		]) {
			await requestAgent.get(`/v1/probes/${PROBE_ID}/logs`)
				.query(query)
				.set('Cookie', `${sessionConfig.cookieName}=${jwt}`)
				.send()
				.expect(400);
		}
	});
});
