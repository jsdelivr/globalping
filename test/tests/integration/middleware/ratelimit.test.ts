import type {Server} from 'node:http';
import request, {Response} from 'supertest';
import requestIp from 'request-ip';
import type {RateLimiterRedis} from 'rate-limiter-flexible';
import {expect} from 'chai';
import {getTestServer} from '../../../utils/http.js';

describe('rate limiter', () => {
	let app: Server;
	let requestAgent: any;
	let clientIpv6: string;
	let rateLimiterInstance: RateLimiterRedis;

	before(async function () {
		this.timeout(15_000);
		app = await getTestServer();
		requestAgent = request(app);

		// eslint-disable-next-line @typescript-eslint/no-unsafe-call
		const httpResponse = await requestAgent.post('/v1/').send() as Response & {req: any};
		// Supertest renders request as ipv4
		const clientIp = requestIp.getClientIp(httpResponse.req);
		// Koa sees ipv6-ipv4 monster
		clientIpv6 = `::ffff:${clientIp ?? ''}`;

		// eslint-disable-next-line node/no-unsupported-features/es-syntax
		const rateLimiter = await import('../../../../src/lib/ratelimiter.js');
		rateLimiterInstance = rateLimiter.default;
	});

	afterEach(async () => {
		await rateLimiterInstance.delete(clientIpv6);
	});

	describe('headers', () => {
		it('should NOT include headers (GET)', async () => {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-call
			const response = await requestAgent.get('/v1/').send() as Response;

			expect(response.headers['x-ratelimit-limit']).to.not.exist;
			expect(response.headers['x-ratelimit-remaining']).to.not.exist;
			expect(response.headers['x-ratelimit-reset']).to.not.exist;
		});

		it('should include headers (POST)', async () => {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-call
			const response = await requestAgent.post('/v1/').send() as Response;

			expect(response.headers['x-ratelimit-limit']).to.exist;
			expect(response.headers['x-ratelimit-remaining']).to.exist;
			expect(response.headers['x-ratelimit-reset']).to.exist;
		});

		it('should change values on next request (5) (POST)', async () => {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-call
			const requestPromise = () => requestAgent.post('/v1/').send() as Response;
			const responseList = await Promise.all(Array.from({length: 5}).map(() => requestPromise()));

			const firstResponse = responseList[0];
			const lastResponse = responseList[4];

			expect(responseList).to.have.lengthOf(5);
			expect(firstResponse?.headers?.['x-ratelimit-remaining']).to.not.equal(lastResponse?.headers?.['x-ratelimit-remaining']);
		});
	});

	describe('access', () => {
		it('should succeed (limit not reached)', async () => {
			await rateLimiterInstance.set(clientIpv6, 0, 0);

			// eslint-disable-next-line @typescript-eslint/no-unsafe-call
			const response = await requestAgent.post('/v1/').send() as Response;

			expect(Number(response.headers['x-ratelimit-remaining'])).to.equal(99);
		});

		it('should fail (limit reached) (start at 100)', async () => {
			await rateLimiterInstance.set(clientIpv6, 100, 0);

			// eslint-disable-next-line @typescript-eslint/no-unsafe-call
			const response = await requestAgent.post('/v1/').send() as Response;

			expect(Number(response.headers['x-ratelimit-remaining'])).to.equal(0);
			expect(response.statusCode).to.equal(429);
		});
	});
});
