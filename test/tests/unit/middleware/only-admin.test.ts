import type { Context } from 'koa';
import * as sinon from 'sinon';
import { expect } from 'chai';
import createHttpError from 'http-errors';
import { onlyAdmin } from '../../../../src/lib/http/middleware/only-admin.js';

const next = sinon.stub();

beforeEach(() => {
	sinon.resetHistory();
});

describe('rate limit middleware', () => {
	it('should reject requests with "isAdmin" false', async () => {
		const ctx = { isAdmin: false } as unknown as Context;
		const err = await onlyAdmin()(ctx, next).catch((err: unknown) => err);
		expect(err).to.deep.equal(createHttpError(403, 'Forbidden', { type: 'access_forbidden' }));
		expect(next.callCount).to.equal(0);
	});

	it('should accept requests with "isAdmin" true', async () => {
		const ctx = { isAdmin: true } as unknown as Context;
		await onlyAdmin()(ctx, next);
		expect(next.callCount).to.equal(1);
	});
});
