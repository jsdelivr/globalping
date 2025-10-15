import type { Server } from 'node:http';
import request, { type Response } from 'supertest';
import { expect } from 'chai';
import { getTestServer, addFakeProbe, deleteFakeProbes, waitForProbesUpdate } from '../../utils/server.js';
import nockGeoIpProviders from '../../utils/nock-geo-ip.js';
import { anonymousRateLimiter as anonymousPostRateLimiter, authenticatedRateLimiter as authenticatedPostRateLimiter, failedCreditsAttempts } from '../../../src/lib/rate-limiter/rate-limiter-post.js';
import { rateLimiter as getRateLimiter } from '../../../src/lib/rate-limiter/rate-limiter-get.js';
import { dashboardClient } from '../../../src/lib/sql/client.js';
import { GP_TOKENS_TABLE } from '../../../src/lib/http/auth.js';
import { CREDITS_TABLE } from '../../../src/lib/credits.js';
import { getPersistentRedisClient } from '../../../src/lib/redis/persistent-client.js';

describe('rate limiter', () => {
	let app: Server;
	let requestAgent: any;
	let clientId: string;
	const redis = getPersistentRedisClient();

	before(async () => {
		app = await getTestServer();
		requestAgent = request(app);

		await requestAgent.post('/v1/').send();
		clientId = '127.0.0.1';

		nockGeoIpProviders();
		nockGeoIpProviders();

		const probe1 = await addFakeProbe();
		const probe2 = await addFakeProbe();

		probe1.emit('probe:status:update', 'ready');
		probe1.emit('probe:isIPv4Supported:update', true);
		probe2.emit('probe:status:update', 'ready');
		probe2.emit('probe:isIPv4Supported:update', true);

		await waitForProbesUpdate();

		await dashboardClient(GP_TOKENS_TABLE).insert([{
			name: 'test token',
			user_created: '89da69bd-a236-4ab7-9c5d-b5f52ce09959',
			value: 'Xj6kuKFEQ6zI60mr+ckHG7yQcIFGMJFzvtK9PBQ69y8=', // token: qz5kdukfcr3vggv3xbujvjwvirkpkkpx
		}, {
			name: 'anon token',
			user_created: null,
			value: '1CJTN06QAyM2JYA3r2FwaSytXEWg1r50xNlUyC1G98w=', // token: t6jy4n6nw5jdqxhs5wlkvw7tqsabt734
		}]);
	});


	afterEach(async () => {
		const [ getKeys ] = await Promise.all([
			await redis.keys(`rate:get:${clientId}:*`),
			await anonymousPostRateLimiter.delete(clientId),
			await authenticatedPostRateLimiter.delete('89da69bd-a236-4ab7-9c5d-b5f52ce09959'),
		]);

		getKeys.length && await redis.del(getKeys);
		failedCreditsAttempts.clear();
	});

	after(async () => {
		await deleteFakeProbes();
		await dashboardClient(GP_TOKENS_TABLE).where({ value: 'Xj6kuKFEQ6zI60mr+ckHG7yQcIFGMJFzvtK9PBQ69y8=' }).delete();
	});

	describe('headers', () => {
		it('should NOT include headers (GET)', async () => {
			const response = await requestAgent.get('/v1/').send().expect(404) as Response;

			expect(response.headers['x-ratelimit-limit']).to.not.exist;
			expect(response.headers['x-ratelimit-consumed']).to.not.exist;
			expect(response.headers['x-ratelimit-remaining']).to.not.exist;
			expect(response.headers['x-ratelimit-reset']).to.not.exist;
			expect(response.headers['x-request-cost']).to.not.exist;
		});

		it('should NOT include headers if body is not valid (POST)', async () => {
			const response = await requestAgent.post('/v1/measurements').send().expect(400) as Response;

			expect(response.headers['x-ratelimit-limit']).to.not.exist;
			expect(response.headers['x-ratelimit-consumed']).to.not.exist;
			expect(response.headers['x-ratelimit-remaining']).to.not.exist;
			expect(response.headers['x-ratelimit-reset']).to.not.exist;
			expect(response.headers['x-request-cost']).to.not.exist;
		});

		it('should include headers (POST)', async () => {
			const response = await requestAgent.post('/v1/measurements').send({
				type: 'ping',
				target: 'jsdelivr.com',
			}).expect(202) as Response;

			expect(response.headers['x-ratelimit-limit']).to.exist;
			expect(response.headers['x-ratelimit-consumed']).to.exist;
			expect(response.headers['x-ratelimit-remaining']).to.exist;
			expect(response.headers['x-ratelimit-reset']).to.exist;
			expect(response.headers['x-request-cost']).to.exist;
		});

		it('should include headers (authenticated POST)', async () => {
			const response = await requestAgent.post('/v1/measurements')
				.set('Authorization', 'Bearer qz5kdukfcr3vggv3xbujvjwvirkpkkpx')
				.send({
					type: 'ping',
					target: 'jsdelivr.com',
				}).expect(202) as Response;

			expect(response.headers['x-ratelimit-limit']).to.exist;
			expect(response.headers['x-ratelimit-consumed']).to.exist;
			expect(response.headers['x-ratelimit-remaining']).to.exist;
			expect(response.headers['x-ratelimit-reset']).to.exist;
			expect(response.headers['x-request-cost']).to.exist;
		});

		it('should change values on multiple requests (POST)', async () => {
			const response = await requestAgent.post('/v1/measurements').send({
				type: 'ping',
				target: 'jsdelivr.com',
			}).expect(202) as Response;

			expect(response.headers['x-ratelimit-limit']).to.equal('250');
			expect(response.headers['x-ratelimit-consumed']).to.equal('1');
			expect(response.headers['x-ratelimit-remaining']).to.equal('249');
			expect(response.headers['x-ratelimit-reset']).to.equal('3600');
			expect(response.headers['x-request-cost']).to.equal('1');

			const response2 = await requestAgent.post('/v1/measurements').send({
				type: 'ping',
				target: 'jsdelivr.com',
			}).expect(202) as Response;

			expect(response2.headers['x-ratelimit-limit']).to.equal('250');
			expect(response2.headers['x-ratelimit-consumed']).to.equal('1');
			expect(response2.headers['x-ratelimit-remaining']).to.equal('248');
			expect(response2.headers['x-ratelimit-reset']).to.equal('3600');
			expect(response2.headers['x-request-cost']).to.equal('1');
		});

		it('should change values on multiple requests (POST, different IPv6 addresses, same /64 prefix)', async () => {
			const response = await requestAgent.post('/v1/measurements').set('X-Forwarded-For', '1261:ee75:8af3:70c8::ffff').send({
				type: 'ping',
				target: 'jsdelivr.com',
			}).expect(202) as Response;

			expect(response.headers['x-ratelimit-limit']).to.equal('250');
			expect(response.headers['x-ratelimit-consumed']).to.equal('1');
			expect(response.headers['x-ratelimit-remaining']).to.equal('249');
			expect(response.headers['x-ratelimit-reset']).to.equal('3600');
			expect(response.headers['x-request-cost']).to.equal('1');

			const response2 = await requestAgent.post('/v1/measurements').set('X-Forwarded-For', '1261:ee75:8af3:70c8::eeee').send({
				type: 'ping',
				target: 'jsdelivr.com',
			}).expect(202) as Response;

			expect(response2.headers['x-ratelimit-limit']).to.equal('250');
			expect(response2.headers['x-ratelimit-consumed']).to.equal('1');
			expect(response2.headers['x-ratelimit-remaining']).to.equal('248');
			expect(response2.headers['x-ratelimit-reset']).to.equal('3600');
			expect(response2.headers['x-request-cost']).to.equal('1');
		});

		it('should not change values on multiple requests (POST, IPv4-mapped IPv6)', async () => {
			const response = await requestAgent.post('/v1/measurements').set('X-Forwarded-For', '::ffff:192.0.2.128').send({
				type: 'ping',
				target: 'jsdelivr.com',
			}).expect(202) as Response;

			expect(response.headers['x-ratelimit-limit']).to.equal('250');
			expect(response.headers['x-ratelimit-consumed']).to.equal('1');
			expect(response.headers['x-ratelimit-remaining']).to.equal('249');
			expect(response.headers['x-ratelimit-reset']).to.equal('3600');
			expect(response.headers['x-request-cost']).to.equal('1');

			const response2 = await requestAgent.post('/v1/measurements').set('X-Forwarded-For', '::ffff:192.0.2.129').send({
				type: 'ping',
				target: 'jsdelivr.com',
			}).expect(202) as Response;

			expect(response2.headers['x-ratelimit-limit']).to.equal('250');
			expect(response2.headers['x-ratelimit-consumed']).to.equal('1');
			expect(response2.headers['x-ratelimit-remaining']).to.equal('249');
			expect(response2.headers['x-ratelimit-reset']).to.equal('3600');
			expect(response2.headers['x-request-cost']).to.equal('1');
		});

		it('should change values on multiple requests (authenticated POST)', async () => {
			const response = await requestAgent.post('/v1/measurements')
				.set('Authorization', 'Bearer qz5kdukfcr3vggv3xbujvjwvirkpkkpx')
				.send({
					type: 'ping',
					target: 'jsdelivr.com',
				}).expect(202) as Response;

			expect(response.headers['x-ratelimit-limit']).to.equal('500');
			expect(response.headers['x-ratelimit-consumed']).to.equal('1');
			expect(response.headers['x-ratelimit-remaining']).to.equal('499');
			expect(response.headers['x-ratelimit-reset']).to.equal('3600');
			expect(response.headers['x-request-cost']).to.equal('1');

			const response2 = await requestAgent.post('/v1/measurements')
				.set('Authorization', 'Bearer qz5kdukfcr3vggv3xbujvjwvirkpkkpx')
				.send({
					type: 'ping',
					target: 'jsdelivr.com',
				}).expect(202) as Response;

			expect(response2.headers['x-ratelimit-limit']).to.equal('500');
			expect(response.headers['x-ratelimit-consumed']).to.equal('1');
			expect(response2.headers['x-ratelimit-remaining']).to.equal('498');
			expect(response2.headers['x-ratelimit-reset']).to.equal('3600');
			expect(response.headers['x-request-cost']).to.equal('1');
		});

		it('should NOT include headers (GET measurement)', async () => {
			const { body: { id } } = await requestAgent.post('/v1/measurements')
				.send({
					type: 'ping',
					target: 'jsdelivr.com',
				}).expect(202) as Response;
			await getRateLimiter.set(`${clientId}:${id}`, 999, 0);
			const response = await requestAgent.get(`/v1/measurements/${id}`).send().expect(200) as Response;

			expect(response.headers['Retry-After']).to.not.exist;
		});
	});

	describe('anonymous access', () => {
		it('should succeed (limit not reached)', async () => {
			await anonymousPostRateLimiter.set(clientId, 0, 0);

			const response = await requestAgent.post('/v1/measurements').send({
				type: 'ping',
				target: 'jsdelivr.com',
			}).expect(202) as Response;

			expect(response.headers['x-ratelimit-remaining']).to.equal('249');
		});

		it('should fail (limit reached)', async () => {
			await anonymousPostRateLimiter.set(clientId, 250, 0);

			const response = await requestAgent.post('/v1/measurements').send({
				type: 'ping',
				target: 'jsdelivr.com',
			}).expect(429) as Response;

			expect(response.headers['x-ratelimit-remaining']).to.equal('0');
		});

		it('should consume all points successfully or none at all (cost > remaining > 0)', async () => {
			await anonymousPostRateLimiter.set(clientId, 249, 0); // 1 remaining

			const response = await requestAgent.post('/v1/measurements').send({
				type: 'ping',
				target: 'jsdelivr.com',
				limit: 2,
			}).expect(429) as Response;

			expect(response.headers['x-ratelimit-remaining']).to.equal('1');
		});

		it('should fail and include Retry-After header (GET measurement)', async () => {
			const { body: { id } } = await requestAgent.post('/v1/measurements')
				.send({
					type: 'ping',
					target: 'jsdelivr.com',
				}).expect(202) as Response;
			await getRateLimiter.set(`${clientId}:${id}`, 1000, 0);
			const response = await requestAgent.get(`/v1/measurements/${id}`).send().expect(429) as Response;

			expect(response.headers['retry-after']).to.equal('5');
		});
	});

	describe('authenticated access', () => {
		it('should succeed (limit not reached)', async () => {
			await authenticatedPostRateLimiter.set('89da69bd-a236-4ab7-9c5d-b5f52ce09959', 0, 0);

			const response = await requestAgent.post('/v1/measurements')
				.set('Authorization', 'Bearer qz5kdukfcr3vggv3xbujvjwvirkpkkpx')
				.send({
					type: 'ping',
					target: 'jsdelivr.com',
				}).expect(202) as Response;

			expect(response.headers['x-ratelimit-remaining']).to.equal('499');
		});

		it('should fail (limit reached)', async () => {
			await authenticatedPostRateLimiter.set('89da69bd-a236-4ab7-9c5d-b5f52ce09959', 500, 0);

			const response = await requestAgent.post('/v1/measurements')
				.set('Authorization', 'Bearer qz5kdukfcr3vggv3xbujvjwvirkpkkpx')
				.send({
					type: 'ping',
					target: 'jsdelivr.com',
				}).expect(429) as Response;

			expect(response.headers['x-ratelimit-remaining']).to.equal('0');
		});

		it('should consume all points successfully or none at all (cost > remaining > 0)', async () => {
			await authenticatedPostRateLimiter.set('89da69bd-a236-4ab7-9c5d-b5f52ce09959', 499, 0); // 1 remaining

			const response = await requestAgent.post('/v1/measurements')
				.set('Authorization', 'Bearer qz5kdukfcr3vggv3xbujvjwvirkpkkpx')
				.send({
					type: 'ping',
					target: 'jsdelivr.com',
					limit: 2,
				}).expect(429) as Response;

			expect(response.headers['x-ratelimit-remaining']).to.equal('1');
		});

		it('should fail and include Retry-After header if ip limit is applied (GET measurement)', async () => {
			const { body: { id } } = await requestAgent.post('/v1/measurements')
				.send({
					type: 'ping',
					target: 'jsdelivr.com',
				}).expect(202) as Response;
			await getRateLimiter.set(`${clientId}:${id}`, 1000, 0);
			const response = await requestAgent.get(`/v1/measurements/${id}`)
				.set('Authorization', 'Bearer qz5kdukfcr3vggv3xbujvjwvirkpkkpx')
				.send().expect(429) as Response;

			expect(response.headers['retry-after']).to.equal('5');
		});

		it('should use hashed token as a key for anonymous tokens', async () => {
			await requestAgent.post('/v1/measurements')
				.set('Authorization', 'Bearer t6jy4n6nw5jdqxhs5wlkvw7tqsabt734')
				.send({
					type: 'ping',
					target: 'jsdelivr.com',
				}).expect(202) as Response;

			const rateLimiterRes = await anonymousPostRateLimiter.get(`1CJTN06QAyM2JYA3r2FwaSytXEWg1r50xNlUyC1G98w=`);
			expect(rateLimiterRes?.remainingPoints).to.equal(249);
		});
	});

	describe('access with credits', () => {
		beforeEach(async () => {
			await dashboardClient(CREDITS_TABLE).insert({
				user_id: '89da69bd-a236-4ab7-9c5d-b5f52ce09959',
				amount: 10,
			}).onConflict().merge({
				amount: 10,
			});
		});

		it('should consume free credits before paid credits', async () => {
			await authenticatedPostRateLimiter.set('89da69bd-a236-4ab7-9c5d-b5f52ce09959', 0, 0);

			const response = await requestAgent.post('/v1/measurements')
				.set('Authorization', 'Bearer qz5kdukfcr3vggv3xbujvjwvirkpkkpx')
				.send({
					type: 'ping',
					target: 'jsdelivr.com',
					limit: 2,
				}).expect(202) as Response;

			expect(response.headers['x-ratelimit-consumed']).to.equal('2');
			expect(response.headers['x-ratelimit-remaining']).to.equal('498');
			expect(response.headers['x-credits-consumed']).to.not.exist;
			expect(response.headers['x-credits-remaining']).to.not.exist;
			expect(response.headers['x-request-cost']).to.equal('2');
			const [{ amount }] = await dashboardClient(CREDITS_TABLE).select('amount').where({ user_id: '89da69bd-a236-4ab7-9c5d-b5f52ce09959' });
			expect(amount).to.equal(10);
		});

		it('should consume credits after limit is reached', async () => {
			await authenticatedPostRateLimiter.set('89da69bd-a236-4ab7-9c5d-b5f52ce09959', 500, 0);

			const response = await requestAgent.post('/v1/measurements')
				.set('Authorization', 'Bearer qz5kdukfcr3vggv3xbujvjwvirkpkkpx')
				.send({
					type: 'ping',
					target: 'jsdelivr.com',
					limit: 2,
				}).expect(202) as Response;

			expect(response.headers['x-ratelimit-consumed']).to.equal('0');
			expect(response.headers['x-ratelimit-remaining']).to.equal('0');
			expect(response.headers['x-credits-consumed']).to.equal('2');
			expect(response.headers['x-credits-remaining']).to.equal('8');
			expect(response.headers['x-request-cost']).to.equal('2');
			const [{ amount }] = await dashboardClient(CREDITS_TABLE).select('amount').where({ user_id: '89da69bd-a236-4ab7-9c5d-b5f52ce09959' });
			expect(amount).to.equal(8);
		});

		it('should consume part from free credits and part from paid credits if possible', async () => {
			await authenticatedPostRateLimiter.set('89da69bd-a236-4ab7-9c5d-b5f52ce09959', 499, 0);

			const response = await requestAgent.post('/v1/measurements')
				.set('Authorization', 'Bearer qz5kdukfcr3vggv3xbujvjwvirkpkkpx')
				.send({
					type: 'ping',
					target: 'jsdelivr.com',
					limit: 2,
				}).expect(202) as Response;

			expect(response.headers['x-ratelimit-consumed']).to.equal('1');
			expect(response.headers['x-ratelimit-remaining']).to.equal('0');
			expect(response.headers['x-credits-consumed']).to.equal('1');
			expect(response.headers['x-credits-remaining']).to.equal('9');
			expect(response.headers['x-request-cost']).to.equal('2');
			const [{ amount }] = await dashboardClient(CREDITS_TABLE).select('amount').where({ user_id: '89da69bd-a236-4ab7-9c5d-b5f52ce09959' });
			expect(amount).to.equal(9);
		});

		it('should not consume paid credits if there are not enough to satisfy the request', async () => {
			await authenticatedPostRateLimiter.set('89da69bd-a236-4ab7-9c5d-b5f52ce09959', 500, 0);

			await dashboardClient(CREDITS_TABLE).update({
				amount: 1,
			}).where({
				user_id: '89da69bd-a236-4ab7-9c5d-b5f52ce09959',
			});

			const response = await requestAgent.post('/v1/measurements')
				.set('Authorization', 'Bearer qz5kdukfcr3vggv3xbujvjwvirkpkkpx')
				.send({
					type: 'ping',
					target: 'jsdelivr.com',
					limit: 2,
				}).expect(429) as Response;

			expect(response.headers['x-ratelimit-consumed']).to.equal('0');
			expect(response.headers['x-ratelimit-remaining']).to.equal('0');
			expect(response.headers['x-credits-consumed']).to.equal('0');
			expect(response.headers['x-credits-remaining']).to.equal('1');
			expect(response.headers['x-request-cost']).to.equal('2');
			const [{ amount }] = await dashboardClient(CREDITS_TABLE).select('amount').where({ user_id: '89da69bd-a236-4ab7-9c5d-b5f52ce09959' });
			expect(amount).to.equal(1);
		});

		it('should not consume more paid credits than the cost of the full request', async () => {
			await authenticatedPostRateLimiter.set('89da69bd-a236-4ab7-9c5d-b5f52ce09959', 505, 0);

			const response = await requestAgent.post('/v1/measurements')
				.set('Authorization', 'Bearer qz5kdukfcr3vggv3xbujvjwvirkpkkpx')
				.send({
					type: 'ping',
					target: 'jsdelivr.com',
					limit: 2,
				}).expect(202) as Response;

			expect(response.headers['x-ratelimit-consumed']).to.equal('0');
			expect(response.headers['x-ratelimit-remaining']).to.equal('0');
			expect(response.headers['x-credits-consumed']).to.equal('2');
			expect(response.headers['x-credits-remaining']).to.equal('8');
			expect(response.headers['x-request-cost']).to.equal('2');
			const [{ amount }] = await dashboardClient(CREDITS_TABLE).select('amount').where({ user_id: '89da69bd-a236-4ab7-9c5d-b5f52ce09959' });
			expect(amount).to.equal(8);
		});

		it('should not consume free credits if there are not enough to satisfy the request', async () => {
			await authenticatedPostRateLimiter.set('89da69bd-a236-4ab7-9c5d-b5f52ce09959', 499, 0);

			await dashboardClient(CREDITS_TABLE).update({
				amount: 0,
			}).where({
				user_id: '89da69bd-a236-4ab7-9c5d-b5f52ce09959',
			});

			const response = await requestAgent.post('/v1/measurements')
				.set('Authorization', 'Bearer qz5kdukfcr3vggv3xbujvjwvirkpkkpx')
				.send({
					type: 'ping',
					target: 'jsdelivr.com',
					limit: 2,
				}).expect(429) as Response;

			expect(response.headers['x-ratelimit-consumed']).to.equal('0');
			expect(response.headers['x-ratelimit-remaining']).to.equal('1');
			expect(response.headers['x-credits-consumed']).to.equal('0');
			expect(response.headers['x-credits-remaining']).to.equal('0');
			expect(response.headers['x-request-cost']).to.equal('2');
			const [{ amount }] = await dashboardClient(CREDITS_TABLE).select('amount').where({ user_id: '89da69bd-a236-4ab7-9c5d-b5f52ce09959' });
			expect(amount).to.equal(0);
		});

		it('should work fine if there is no credits row for that user', async () => {
			await authenticatedPostRateLimiter.set('89da69bd-a236-4ab7-9c5d-b5f52ce09959', 500, 0);

			await dashboardClient(CREDITS_TABLE).where({
				user_id: '89da69bd-a236-4ab7-9c5d-b5f52ce09959',
			}).delete();

			const response = await requestAgent.post('/v1/measurements')
				.set('Authorization', 'Bearer qz5kdukfcr3vggv3xbujvjwvirkpkkpx')
				.send({
					type: 'ping',
					target: 'jsdelivr.com',
					limit: 2,
				}).expect(429) as Response;

			expect(response.headers['x-ratelimit-consumed']).to.equal('0');
			expect(response.headers['x-ratelimit-remaining']).to.equal('0');
			expect(response.headers['x-credits-consumed']).to.equal('0');
			expect(response.headers['x-credits-remaining']).to.equal('0');
			expect(response.headers['x-request-cost']).to.equal('2');
			const credits = await dashboardClient(CREDITS_TABLE).select('amount').where({ user_id: '89da69bd-a236-4ab7-9c5d-b5f52ce09959' });
			expect(credits).to.deep.equal([]);
		});
	});
});
