import type { Server } from 'node:http';
import config from 'config';
import { SignJWT } from 'jose';
import request from 'supertest';
import { expect } from 'chai';
import { getTestServer, addFakeProbe, deleteFakeProbes, waitForProbesUpdate } from '../../utils/server.js';
import nockGeoIpProviders from '../../utils/nock-geo-ip.js';
import { anonymousRateLimiter, authenticatedRateLimiter } from '../../../src/lib/rate-limiter/rate-limiter-post.js';
import { dashboardClient } from '../../../src/lib/sql/client.js';
import { GP_TOKENS_TABLE } from '../../../src/lib/http/auth.js';
import { createOrg, createUser } from '../../utils/fixtures.js';
import { CREDITS_TABLE } from '../../../src/lib/credits-master.js';
import type { AuthenticateOptions } from '../../../src/lib/http/middleware/authenticate.js';

const sessionConfig = config.get<AuthenticateOptions['session']>('server.session');

const insertCredits = (accountId: string, amount: number) => {
	return dashboardClient(CREDITS_TABLE).insert({ account_id: accountId, amount }).onConflict().merge();
};

describe('rate limiter', () => {
	let app: Server;
	let requestAgent: any;
	let clientId: string;
	let user: { id: string; accountId: string };
	let memberOrg: { id: string; accountId: string };
	let viewerOrg: { id: string; accountId: string };
	let otherOrg: { id: string; accountId: string };

	const getCookies = async (userId: string, activeAccountId?: string) => {
		const jwt = await new SignJWT({ id: userId, app_access: true, user_account_id: user.accountId })
			.setProtectedHeader({ alg: 'HS256' })
			.setIssuedAt()
			.setExpirationTime('1h')
			.sign(Buffer.from(sessionConfig.cookieSecret));

		return [
			`${sessionConfig.cookieName}=${jwt}`,
			...activeAccountId ? [ `${sessionConfig.activeAccountCookieName}=${activeAccountId}` ] : [],
		];
	};

	before(async () => {
		user = await createUser(dashboardClient);
		memberOrg = await createOrg(dashboardClient, { name: 'member-org', members: [{ userId: user.id, role: 'member' }] });
		viewerOrg = await createOrg(dashboardClient, { name: 'viewer-org', members: [{ userId: user.id, role: 'viewer' }] });
		otherOrg = await createOrg(dashboardClient, { name: 'other-org' });

		app = await getTestServer();
		requestAgent = request(app);

		await requestAgent.post('/v1/').send();
		clientId = '127.0.0.1';

		nockGeoIpProviders();

		const probe = await addFakeProbe();

		probe.emit('probe:status:update', 'ready');
		probe.emit('probe:isIPv4Supported:update', true);

		await waitForProbesUpdate();

		await dashboardClient(GP_TOKENS_TABLE).insert({
			name: 'test token',
			user_created: user.id,
			account_id: user.accountId,
			value: 'Xj6kuKFEQ6zI60mr+ckHG7yQcIFGMJFzvtK9PBQ69y8=', // token: qz5kdukfcr3vggv3xbujvjwvirkpkkpx
		});
	});


	afterEach(async () => {
		await anonymousRateLimiter.delete(clientId);
		await authenticatedRateLimiter.delete(user.accountId);
		await dashboardClient(CREDITS_TABLE).delete();
	});

	after(async () => {
		await deleteFakeProbes();
		await dashboardClient(GP_TOKENS_TABLE).where({ value: 'Xj6kuKFEQ6zI60mr+ckHG7yQcIFGMJFzvtK9PBQ69y8=' }).delete();
	});

	describe('/limits', () => {
		describe('anonymouns request', () => {
			it('should return default values if there is no rate limit record', async () => {
				const response = await requestAgent.get('/v1/limits').send();
				expect(response.body).to.deep.equal({
					rateLimit: {
						measurements: {
							create: {
								type: 'ip',
								limit: 250,
								remaining: 250,
								reset: 0,
							},
						},
					},
				});
			});

			it('should return values for that ip', async () => {
				await requestAgent.post('/v1/measurements').send({
					type: 'ping',
					target: 'jsdelivr.com',
				}).expect(202);

				const response = await requestAgent.get('/v1/limits').send();
				expect(response.body).to.deep.equal({
					rateLimit: {
						measurements: {
							create: {
								type: 'ip',
								limit: 250,
								remaining: 249,
								reset: 3600,
							},
						},
					},
				});
			});
		});

		describe('authenticated request', () => {
			it('should return default values if there is no rate limit record', async () => {
				const response = await requestAgent.get('/v1/limits')
					.set('Authorization', 'Bearer qz5kdukfcr3vggv3xbujvjwvirkpkkpx')
					.send();
				expect(response.body).to.deep.equal({
					rateLimit: {
						measurements: {
							create: {
								type: 'user',
								limit: 500,
								remaining: 500,
								reset: 0,
							},
						},
					},
					credits: { remaining: 0 },
				});
			});

			it('should return values for that user', async () => {
				await requestAgent.post('/v1/measurements')
					.set('Authorization', 'Bearer qz5kdukfcr3vggv3xbujvjwvirkpkkpx')
					.send({
						type: 'ping',
						target: 'jsdelivr.com',
					}).expect(202);

				const response = await requestAgent.get('/v1/limits')
					.set('Authorization', 'Bearer qz5kdukfcr3vggv3xbujvjwvirkpkkpx')
					.send();
				expect(response.body).to.deep.equal({
					rateLimit: {
						measurements: {
							create: {
								type: 'user',
								limit: 500,
								remaining: 499,
								reset: 3600,
							},
						},
					},
					credits: { remaining: 0 },
				});
			});

			it('should return current amount of user credits', async () => {
				await dashboardClient(CREDITS_TABLE).insert({
					account_id: user.accountId,
					amount: 10,
				}).onConflict().merge();

				const response = await requestAgent.get('/v1/limits')
					.set('Authorization', 'Bearer qz5kdukfcr3vggv3xbujvjwvirkpkkpx')
					.send();
				expect(response.body).to.deep.equal({
					rateLimit: {
						measurements: {
							create: {
								type: 'user',
								limit: 500,
								remaining: 500,
								reset: 0,
							},
						},
					},
					credits: { remaining: 10 },
				});
			});

			it('should take the account from the session cookie if no active account is set', async () => {
				await insertCredits(user.accountId, 10);

				const response = await requestAgent.get('/v1/limits')
					.set('Cookie', await getCookies('cookie-user-id'))
					.send();

				expect(response.body.credits).to.deep.equal({ remaining: 10 });
			});

			it('should act for the org the dashboard switched to', async () => {
				await insertCredits(user.accountId, 10);
				await insertCredits(memberOrg.accountId, 20);

				const response = await requestAgent.get('/v1/limits')
					.set('Cookie', await getCookies(user.id, memberOrg.accountId))
					.send();

				expect(response.body.credits).to.deep.equal({ remaining: 20 });
			});

			it('should ignore an org the user is not a member of', async () => {
				await insertCredits(user.accountId, 10);
				await insertCredits(otherOrg.accountId, 20);

				const response = await requestAgent.get('/v1/limits')
					.set('Cookie', await getCookies(user.id, otherOrg.accountId))
					.send();

				expect(response.body.credits).to.deep.equal({ remaining: 10 });
			});

			it('should ignore an org where the user is only a viewer', async () => {
				await insertCredits(user.accountId, 10);
				await insertCredits(viewerOrg.accountId, 20);

				const response = await requestAgent.get('/v1/limits')
					.set('Cookie', await getCookies(user.id, viewerOrg.accountId))
					.send();

				expect(response.body.credits).to.deep.equal({ remaining: 10 });
			});
		});
	});
});
