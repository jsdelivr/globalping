import * as sinon from 'sinon';
import { expect } from 'chai';
import rateLimiter from '../../../../src/lib/ratelimiter.js';
import { rateLimitHandler } from '../../../../src/lib/http/middleware/ratelimit.js';
import createHttpError from 'http-errors';

describe('rate limit middleware', () => {
	const defaultCtx: any = {
		set: sinon.stub(),
		req: {},
		request: {
			body: {},
		},
		response: {},
	};
	let ctx = { ...defaultCtx };

	beforeEach(async () => {
		defaultCtx.set.reset();
		ctx = { ...defaultCtx };
		await rateLimiter.delete('');
	});

	it('should set rate limit headers based on the "probesCount" field value', async () => {
		ctx.request.body = {
			limit: 10,
			locations: [],
		};

		const next: any = () => {
			ctx.response.body = {
				id: 'id',
				probesCount: 5,
			};
		};

		await rateLimitHandler()(ctx, next);

		expect(ctx.set.callCount).to.equal(3);
		expect(ctx.set.firstCall.args[0]).to.equal('X-RateLimit-Reset');
		expect(ctx.set.secondCall.args).to.deep.equal([ 'X-RateLimit-Limit', '100000' ]);
		expect(ctx.set.thirdCall.args).to.deep.equal([ 'X-RateLimit-Remaining', '99995' ]);
	});

	it('should throw an error if response body doesn\'t have "probesCount" field', async () => {
		ctx.request.body = {
			limit: 10,
			locations: [],
		};

		const next: any = () => {
			ctx.response.body = {};
		};

		const err = await rateLimitHandler()(ctx, next).catch(err => err);
		expect(err).to.deep.equal(new Error('Missing probesCount field in response object'));
	});

	it('should NOT set rate limit headers for admin', async () => {
		ctx.request.body = {
			limit: 10,
			locations: [],
		};

		ctx.isAdmin = true;

		const next: any = () => {
			ctx.response.body = {
				id: 'id',
				probesCount: 10,
			};
		};

		await rateLimitHandler()(ctx, next);
		expect(ctx.set.callCount).to.equal(0);
	});

	it('should validate request based on the "limit" field value', async () => {
		ctx.request.body = {
			limit: 60000,
			locations: [],
		};

		const next: any = () => {
			ctx.response.body = {
				id: 'id',
				probesCount: 60000,
			};
		};

		await rateLimitHandler()(ctx, next);
		expect(ctx.set.args[2]).to.deep.equal([ 'X-RateLimit-Remaining', '40000' ]);

		const err = await rateLimitHandler()(ctx, next).catch(err => err); // 60000 > 40000 so another request with the same body fails
		expect(err).to.deep.equal(createHttpError(429, 'API rate limit exceeded.', { type: 'rate_limit_exceeded' }));
		expect(ctx.set.args[5]).to.deep.equal([ 'X-RateLimit-Remaining', '40000' ]);

		ctx.request.body = {
			limit: 40000,
			locations: [],
		};

		const next2: any = () => {
			ctx.response.body = {
				id: 'id',
				probesCount: 40000,
			};
		};

		await rateLimitHandler()(ctx, next2); // 40000 === 40000 so request with the updated body works
		expect(ctx.set.args[8]).to.deep.equal([ 'X-RateLimit-Remaining', '0' ]);
	});

	it('should validate request based on the "location.limit" field value', async () => {
		ctx.request.body = {
			locations: [{
				continent: 'EU',
				limit: 45000,
			}, {
				continent: 'NA',
				limit: 45000,
			}],
		};

		const next: any = () => {
			ctx.response.body = {
				id: 'id',
				probesCount: 90000,
			};
		};

		await rateLimitHandler()(ctx, next);
		expect(ctx.set.args[2]).to.deep.equal([ 'X-RateLimit-Remaining', '10000' ]);

		const err = await rateLimitHandler()(ctx, next).catch(err => err); // only 10000 points remaining so another request with the same body fails
		expect(err).to.deep.equal(createHttpError(429, 'API rate limit exceeded.', { type: 'rate_limit_exceeded' }));
		expect(ctx.set.args[5]).to.deep.equal([ 'X-RateLimit-Remaining', '10000' ]);

		ctx.request.body = {
			locations: [{
				continent: 'EU',
				limit: 5000,
			}, {
				continent: 'NA',
				limit: 5000,
			}],
		};

		const next2: any = () => {
			ctx.response.body = {
				id: 'id',
				probesCount: 10000,
			};
		};

		await rateLimitHandler()(ctx, next2); // request with 10000 probes will work fine
		expect(ctx.set.args[8]).to.deep.equal([ 'X-RateLimit-Remaining', '0' ]);
	});
});
