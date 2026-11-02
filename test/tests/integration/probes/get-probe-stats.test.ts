import { expect } from 'chai';
import config from 'config';
import type { JWTPayload } from 'jose';
import request, { type Agent } from 'supertest';
import * as sinon from 'sinon';
import type { AuthenticateOptions } from '../../../../src/lib/http/middleware/authenticate.js';
import type { Adoption } from '../../../../src/lib/override/adopted-probes.js';
import { dashboardClient, timeSeriesClient } from '../../../../src/lib/sql/client.js';
import { createUser } from '../../../utils/fixtures.js';
import { getIoContext, getTestServer } from '../../../utils/server.js';
import { getSignedJwt } from '../../../utils/session.js';

const sessionConfig = config.get<AuthenticateOptions['session']>('server.session');
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe('Get Probe Stats', () => {
	let requestAgent: Agent;
	let sandbox: sinon.SinonSandbox;
	let getByIdStub: sinon.SinonStub;
	let day: number;
	let user: { id: string; accountId: string };
	let mockAdoption: Adoption;

	const PROBE_ID = 'mock-probe-id';
	const PROBE_UUID = 'fb9756c9-a4d7-423f-9ed2-3b848e915159';
	const OTHER_PROBE_UUID = '1b6c8f3e-7c1a-4f6e-9a0f-2d3c4b5a6e7f';
	const zeros = { assigned: 0, finished: 0, failedTarget: 0, failedResolver: 0, failedInternal: 0, timedOut: 0 };

	const getCookie = async (payload: JWTPayload) => `${sessionConfig.cookieName}=${await getSignedJwt(payload)}`;
	const toDate = (time: number) => new Date(time).toISOString().slice(0, 10);

	const insertRow = (probeUuid: string, hour: number, testType: string, counters: Partial<typeof zeros>) => timeSeriesClient('probe_test_stats_hourly').insert({
		probeUuid,
		hour: new Date(hour),
		testType,
		...zeros,
		...counters,
	});

	before(async () => {
		user = await createUser(dashboardClient);
		mockAdoption = { id: PROBE_ID, uuid: PROBE_UUID, accountId: user.accountId } as Adoption;
		requestAgent = request(await getTestServer());
	});

	beforeEach(async () => {
		await timeSeriesClient('probe_test_stats_hourly').delete();
		sandbox = sinon.createSandbox();
		getByIdStub = sandbox.stub(getIoContext().adoptedProbes, 'getById').returns(mockAdoption);
		day = Math.floor(Date.now() / DAY) * DAY - 2 * DAY;

		await insertRow(PROBE_UUID, day, 'ping', { assigned: 10, finished: 7, failedTarget: 1, failedResolver: 1, failedInternal: 1, timedOut: 1 });
		await insertRow(PROBE_UUID, day + 23 * HOUR, 'ping', { assigned: 5, finished: 5 });
		await insertRow(PROBE_UUID, day + 23 * HOUR, 'mtr', { assigned: 2_147_483_647, finished: 2_147_483_647 });
		await insertRow(PROBE_UUID, day + DAY, 'dns', { assigned: 3, failedResolver: 3 });
		await insertRow(OTHER_PROBE_UUID, day, 'ping', { assigned: 100, finished: 100 });
	});

	afterEach(() => {
		sandbox.restore();
	});

	it('returns stats only to the probe owner or an administrator', async () => {
		const ownerCookie = await getCookie({ id: user.id, app_access: true });
		const adminCookie = await getCookie({ id: 'admin-user', admin_access: true, app_access: true });
		const otherCookie = await getCookie({ id: 'other-user', app_access: true });
		const noAccessCookie = await getCookie({ id: user.id, app_access: false });

		for (const cookie of [ ownerCookie, adminCookie ]) {
			const response = await requestAgent.get(`/v1/probes/${PROBE_ID}/stats?period=month`).set('Cookie', cookie).send().expect(200);
			expect(response.body.stats).to.not.be.empty;
		}

		for (const cookie of [ otherCookie, noAccessCookie ]) {
			await requestAgent.get(`/v1/probes/${PROBE_ID}/stats?period=month`).set('Cookie', cookie).send().expect(404);
		}

		await requestAgent.get(`/v1/probes/${PROBE_ID}/stats?period=month`).send().expect(404);

		getByIdStub.returns(null);
		await requestAgent.get('/v1/probes/nonexistent/stats?period=month').set('Cookie', adminCookie).send().expect(404);
	});

	it('returns hourly buckets of a calendar day with all test types', async () => {
		const cookie = await getCookie({ id: user.id, app_access: true });

		await requestAgent.get(`/v1/probes/${PROBE_ID}/stats?period=${toDate(day)}`).set('Cookie', cookie).send().expect(200).expect({
			stats: [
				{
					timestamp: new Date(day).toISOString(),
					tests: {
						ping: { assigned: 10, finished: 7, failedTarget: 1, failedResolver: 1, failedInternal: 1, timedOut: 1 },
						traceroute: zeros,
						dns: zeros,
						http: zeros,
						mtr: zeros,
					},
				},
				{
					timestamp: new Date(day + 23 * HOUR).toISOString(),
					tests: {
						ping: { ...zeros, assigned: 5, finished: 5 },
						traceroute: zeros,
						dns: zeros,
						http: zeros,
						mtr: { ...zeros, assigned: 2_147_483_647, finished: 2_147_483_647 },
					},
				},
			],
		});
	});

	it('returns daily buckets for monthly periods', async () => {
		await insertRow(PROBE_UUID, day, 'mtr', { assigned: 1, finished: 1 });
		const cookie = await getCookie({ id: user.id, app_access: true });

		await requestAgent.get(`/v1/probes/${PROBE_ID}/stats?period=month`).set('Cookie', cookie).send().expect(200).expect({
			stats: [
				{
					timestamp: new Date(day).toISOString(),
					tests: {
						ping: { assigned: 15, finished: 12, failedTarget: 1, failedResolver: 1, failedInternal: 1, timedOut: 1 },
						traceroute: zeros,
						dns: zeros,
						http: zeros,
						mtr: { ...zeros, assigned: 2_147_483_648, finished: 2_147_483_648 },
					},
				},
				{
					timestamp: new Date(day + DAY).toISOString(),
					tests: { ping: zeros, traceroute: zeros, dns: { ...zeros, assigned: 3, failedResolver: 3 }, http: zeros, mtr: zeros },
				},
			],
		});
	});

	it('rejects unsupported periods and parameters', async () => {
		const cookie = await getCookie({ id: user.id, app_access: true });

		for (const query of [ '', '?period=hour', '?period=2026-02-30', '?period=2000', `?period=${new Date().getUTCFullYear() + 2}`, '?period=day&from=2026-01-01' ]) {
			const response = await requestAgent.get(`/v1/probes/${PROBE_ID}/stats${query}`).set('Cookie', cookie).send().expect(400);
			expect(response.body.error.type).to.equal('validation_error');
		}
	});
});
