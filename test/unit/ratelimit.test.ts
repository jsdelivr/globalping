import type {Server} from 'node:http';
import request, {Response} from 'supertest';
import {expect} from 'chai';
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
});
