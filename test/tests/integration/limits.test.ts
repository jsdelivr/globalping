import type { Server } from 'node:http';
import request, { type Response } from 'supertest';
import requestIp from 'request-ip';
import { expect } from 'chai';
import { getTestServer, addFakeProbe, deleteFakeProbes, waitForProbesUpdate } from '../../utils/server.js';
import nockGeoIpProviders from '../../utils/nock-geo-ip.js';
import { anonymousRateLimiter, authenticatedRateLimiter } from '../../../src/lib/rate-limiter/rate-limiter-post.js';
import { client } from '../../../src/lib/sql/client.js';
import { GP_TOKENS_TABLE } from '../../../src/lib/http/auth.js';
import { CREDITS_TABLE } from '../../../src/lib/credits.js';

describe('rate limiter', () => {
	let app: Server;
	let requestAgent: any;
	let clientIpv6: string;

	before(async () => {
		app = await getTestServer();
		requestAgent = request(app);

		const httpResponse = await requestAgent.post('/v1/').send() as Response & {req: any};
		// Supertest renders request as ipv4
		const clientIp = requestIp.getClientIp(httpResponse.req);
		// Koa sees ipv6-ipv4 monster
		clientIpv6 = `::ffff:${clientIp ?? '127.0.0.1'}`;

		nockGeoIpProviders();

		const probe = await addFakeProbe();

		probe.emit('probe:status:update', 'ready');
		probe.emit('probe:isIPv4Supported:update', true);

		await waitForProbesUpdate();

		await client(GP_TOKENS_TABLE).insert({
			name: 'test token',
			user_created: '89da69bd-a236-4ab7-9c5d-b5f52ce09959',
			value: 'Xj6kuKFEQ6zI60mr+ckHG7yQcIFGMJFzvtK9PBQ69y8=', // token: qz5kdukfcr3vggv3xbujvjwvirkpkkpx
		});
	});


	afterEach(async () => {
		await anonymousRateLimiter.delete(clientIpv6);
		await authenticatedRateLimiter.delete('89da69bd-a236-4ab7-9c5d-b5f52ce09959');
		await client(CREDITS_TABLE).where({ user_id: '89da69bd-a236-4ab7-9c5d-b5f52ce09959' }).delete();
	});

	after(async () => {
		await deleteFakeProbes();
		await client(GP_TOKENS_TABLE).where({ value: 'Xj6kuKFEQ6zI60mr+ckHG7yQcIFGMJFzvtK9PBQ69y8=' }).delete();
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
				await client(CREDITS_TABLE).insert({
					user_id: '89da69bd-a236-4ab7-9c5d-b5f52ce09959',
					amount: 10,
				}).onConflict().merge({
					amount: 10,
				});

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
		});
	});
});
