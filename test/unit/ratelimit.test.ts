import type {Server} from 'node:http';
import request, {Response} from 'supertest';
import requestIp from 'request-ip';
import {expect} from 'chai';
import type {RateLimiterRedis} from '../../src/lib/ratelimit/redis.js';
import {getOrInitServer} from '../utils/http.js';

describe('RATE LIMITER', () => {
	let app: Server;
	let requestAgent: any;

	before(async function () {
		this.timeout(5000);
		app = await getOrInitServer();
		requestAgent = request(app);
	});

	describe('headers', () => {
		it('should NOT include headers (GET)', async () => {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-call
			const response = await requestAgent.get('/v1/').send() as Response;

			expect(response.headers['x-ratelimit-limit']).to.not.exist;
			expect(response.headers['x-ratelimit-remaining']).to.not.exist;
			expect(response.headers['x-ratelimit-reset-after']).to.not.exist;
			expect(response.headers['x-ratelimit-reset']).to.not.exist;
		});

		it('should include headers (POST)', async () => {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-call
			const response = await requestAgent.post('/v1/').send() as Response;

			expect(response.headers['x-ratelimit-limit']).to.exist;
			expect(response.headers['x-ratelimit-remaining']).to.exist;
			expect(response.headers['x-ratelimit-reset-after']).to.exist;
			expect(response.headers['x-ratelimit-reset']).to.exist;
		});

		it('should change values on next request (5) (POST)', async () => {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-call
			const requestPromise = () => requestAgent.post('/v1/').send() as Response;
			const responseList = await Promise.all(Array.from({length: 5}).map(_ => requestPromise()));

			const firstResponse = responseList[0];
			const lastResponse = responseList[4];

			expect(responseList).to.have.lengthOf(5);
			expect(firstResponse?.headers?.['x-ratelimit-remaining']).to.not.equal(lastResponse?.headers?.['x-ratelimit-remaining']);
		});
	});

	describe('access', () => {
		let clientIp: string;
		let rateLimiterInstance: RateLimiterRedis;

		before(async () => {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-call
			const httpResponse = await requestAgent.post('/v1/').send() as Response & {req: any};
			clientIp = requestIp.getClientIp(httpResponse.req)!;

			// eslint-disable-next-line node/no-unsupported-features/es-syntax
			const rateLimiter = await import('../../src/lib/ratelimiter.js');
			rateLimiterInstance = rateLimiter.default;
		});

		afterEach(async () => {
			await rateLimiterInstance.delete(clientIp);
		});

		it('should succeed (limit not reached)', async () => {
			await rateLimiterInstance.set(clientIp, 0, 0);

			const response = await rateLimiterInstance.consume(clientIp);

			expect(response?.remainingPoints).to.equal(99);
			expect(response?.consumedPoints).to.equal(1);
		});

		it('should fail (limit reached) (start at 100)', async () => {
			await rateLimiterInstance.set(clientIp, 100, 0);

			const response = await rateLimiterInstance.consume(clientIp);

			expect(response?.remainingPoints).to.equal(0);
			expect(response?.consumedPoints).to.equal(101);
		});
	});
});
