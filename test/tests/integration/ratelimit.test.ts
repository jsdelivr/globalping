import type { Server } from 'node:http';
import request, { type Response } from 'supertest';
import requestIp from 'request-ip';
import { expect } from 'chai';
import { getTestServer, addFakeProbe, deleteFakeProbes } from '../../utils/server.js';
import nockGeoIpProviders from '../../utils/nock-geo-ip.js';
import { anonymousRateLimiter, authenticatedRateLimiter } from '../../../src/lib/rate-limiter.js';
import { client } from '../../../src/lib/sql/client.js';
import { GP_TOKENS_TABLE } from '../../../src/lib/http/auth.js';

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
		nockGeoIpProviders();

		const probe1 = await addFakeProbe();
		const probe2 = await addFakeProbe();

		probe1.emit('probe:status:update', 'ready');
		probe2.emit('probe:status:update', 'ready');

		await client(GP_TOKENS_TABLE).insert({
			user_created: '89da69bd-a236-4ab7-9c5d-b5f52ce09959',
			value: '7emhYIar8eLtwAAjyXUn+h3Cj+Xc9BQcLMC6JAX9fHQ=',
		});
	});


	afterEach(async () => {
		await anonymousRateLimiter.delete(clientIpv6);
		await authenticatedRateLimiter.delete('89da69bd-a236-4ab7-9c5d-b5f52ce09959');
	});

	after(async () => {
		await deleteFakeProbes();
		await client(GP_TOKENS_TABLE).where({ value: '7emhYIar8eLtwAAjyXUn+h3Cj+Xc9BQcLMC6JAX9fHQ=' }).delete();
	});

	describe('headers', () => {
		it('should NOT include headers (GET)', async () => {
			const response = await requestAgent.get('/v1/').send().expect(200) as Response;

			expect(response.headers['x-ratelimit-limit']).to.not.exist;
			expect(response.headers['x-ratelimit-remaining']).to.not.exist;
			expect(response.headers['x-ratelimit-reset']).to.not.exist;
		});

		it('should NOT include headers if body is not valid (POST)', async () => {
			const response = await requestAgent.post('/v1/measurements').send().expect(400) as Response;

			expect(response.headers['x-ratelimit-limit']).to.not.exist;
			expect(response.headers['x-ratelimit-remaining']).to.not.exist;
			expect(response.headers['x-ratelimit-reset']).to.not.exist;
		});

		it('should include headers (POST)', async () => {
			const response = await requestAgent.post('/v1/measurements').send({
				type: 'ping',
				target: 'jsdelivr.com',
			}).expect(202) as Response;

			expect(response.headers['x-ratelimit-limit']).to.exist;
			expect(response.headers['x-ratelimit-remaining']).to.exist;
			expect(response.headers['x-ratelimit-reset']).to.exist;
		});

		it('should include headers (authenticated POST)', async () => {
			const response = await requestAgent.post('/v1/measurements')
				.set('Authorization', 'Bearer v2lUHEVLtVSskaRKDBabpyp4AkzdMnob')
				.send({
					type: 'ping',
					target: 'jsdelivr.com',
				}).expect(202) as Response;

			expect(response.headers['x-ratelimit-limit']).to.exist;
			expect(response.headers['x-ratelimit-remaining']).to.exist;
			expect(response.headers['x-ratelimit-reset']).to.exist;
		});

		it('should change values on multiple requests (POST)', async () => {
			const response = await requestAgent.post('/v1/measurements').send({
				type: 'ping',
				target: 'jsdelivr.com',
			}).expect(202) as Response;

			expect(response.headers['x-ratelimit-limit']).to.equal('100000');
			expect(response.headers['x-ratelimit-remaining']).to.equal('99999');
			expect(response.headers['x-ratelimit-reset']).to.equal('3600');

			const response2 = await requestAgent.post('/v1/measurements').send({
				type: 'ping',
				target: 'jsdelivr.com',
			}).expect(202) as Response;

			expect(response2.headers['x-ratelimit-limit']).to.equal('100000');
			expect(response2.headers['x-ratelimit-remaining']).to.equal('99998');
			expect(response2.headers['x-ratelimit-reset']).to.equal('3600');
		});

		it('should change values on multiple requests (authenticated POST)', async () => {
			const response = await requestAgent.post('/v1/measurements')
				.set('Authorization', 'Bearer v2lUHEVLtVSskaRKDBabpyp4AkzdMnob')
				.send({
					type: 'ping',
					target: 'jsdelivr.com',
				}).expect(202) as Response;

			expect(response.headers['x-ratelimit-limit']).to.equal('250');
			expect(response.headers['x-ratelimit-remaining']).to.equal('249');
			expect(response.headers['x-ratelimit-reset']).to.equal('3600');

			const response2 = await requestAgent.post('/v1/measurements')
				.set('Authorization', 'Bearer v2lUHEVLtVSskaRKDBabpyp4AkzdMnob')
				.send({
					type: 'ping',
					target: 'jsdelivr.com',
				}).expect(202) as Response;

			expect(response2.headers['x-ratelimit-limit']).to.equal('250');
			expect(response2.headers['x-ratelimit-remaining']).to.equal('248');
			expect(response2.headers['x-ratelimit-reset']).to.equal('3600');
		});
	});

	describe('anonymous access', () => {
		it('should succeed (limit not reached)', async () => {
			await anonymousRateLimiter.set(clientIpv6, 0, 0);

			const response = await requestAgent.post('/v1/measurements').send({
				type: 'ping',
				target: 'jsdelivr.com',
			}).expect(202) as Response;

			expect(Number(response.headers['x-ratelimit-remaining'])).to.equal(99999);
		});

		it('should fail (limit reached) (start at 100)', async () => {
			await anonymousRateLimiter.set(clientIpv6, 100000, 0);

			const response = await requestAgent.post('/v1/measurements').send({
				type: 'ping',
				target: 'jsdelivr.com',
			}).expect(429) as Response;

			expect(Number(response.headers['x-ratelimit-remaining'])).to.equal(0);
		});

		it('should consume all points successfully or none at all (cost > remaining > 0)', async () => {
			await anonymousRateLimiter.set(clientIpv6, 99999, 0); // 1 remaining

			const response = await requestAgent.post('/v1/measurements').send({
				type: 'ping',
				target: 'jsdelivr.com',
				limit: 2,
			}).expect(429) as Response;

			expect(Number(response.headers['x-ratelimit-remaining'])).to.equal(1);
		});
	});

	describe('authenticated access', () => {
		it('should succeed (limit not reached)', async () => {
			await authenticatedRateLimiter.set('89da69bd-a236-4ab7-9c5d-b5f52ce09959', 0, 0);

			const response = await requestAgent.post('/v1/measurements')
				.set('Authorization', 'Bearer v2lUHEVLtVSskaRKDBabpyp4AkzdMnob')
				.send({
					type: 'ping',
					target: 'jsdelivr.com',
				}).expect(202) as Response;

			expect(Number(response.headers['x-ratelimit-remaining'])).to.equal(249);
		});

		it('should fail (limit reached) (start at 100)', async () => {
			await authenticatedRateLimiter.set('89da69bd-a236-4ab7-9c5d-b5f52ce09959', 250, 0);

			const response = await requestAgent.post('/v1/measurements')
				.set('Authorization', 'Bearer v2lUHEVLtVSskaRKDBabpyp4AkzdMnob')
				.send({
					type: 'ping',
					target: 'jsdelivr.com',
				}).expect(429) as Response;

			expect(Number(response.headers['x-ratelimit-remaining'])).to.equal(0);
		});

		it('should consume all points successfully or none at all (cost > remaining > 0)', async () => {
			await authenticatedRateLimiter.set('89da69bd-a236-4ab7-9c5d-b5f52ce09959', 249, 0); // 1 remaining

			const response = await requestAgent.post('/v1/measurements')
				.set('Authorization', 'Bearer v2lUHEVLtVSskaRKDBabpyp4AkzdMnob')
				.send({
					type: 'ping',
					target: 'jsdelivr.com',
					limit: 2,
				}).expect(429) as Response;

			expect(Number(response.headers['x-ratelimit-remaining'])).to.equal(1);
		});
	});
});
