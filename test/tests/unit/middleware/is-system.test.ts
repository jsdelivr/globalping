import type { Context } from 'koa';
import * as sinon from 'sinon';
import { expect } from 'chai';
import createHttpError from 'http-errors';
import { isSystem } from '../../../../src/lib/http/middleware/is-system.js';

const next = sinon.stub();

beforeEach(() => {
	sinon.resetHistory();
});

describe('rate limit middleware', () => {
	it('should reject requests without "systemkey" parameter', async () => {
		const ctx = { query: {} } as unknown as Context;
		const err = await isSystem()(ctx, next).catch((err: unknown) => err);
		expect(err).to.deep.equal(createHttpError(403, 'Forbidden', { type: 'access_forbidden' }));
		expect(next.callCount).to.equal(0);
	});

	it('should reject requests with invalid "systemkey" parameter', async () => {
		const ctx = { query: { systemkey: 'wrongkey' } } as unknown as Context;
		const err = await isSystem()(ctx, next).catch((err: unknown) => err);
		expect(err).to.deep.equal(createHttpError(403, 'Forbidden', { type: 'access_forbidden' }));
		expect(next.callCount).to.equal(0);
	});

	it('should accept requests with valid "systemkey" parameter', async () => {
		const ctx = { query: { systemkey: 'system' } } as unknown as Context;
		await isSystem()(ctx, next);
		expect(next.callCount).to.equal(1);
	});
});
