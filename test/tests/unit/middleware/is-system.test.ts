import type { Context } from 'koa';
import * as sinon from 'sinon';
import { expect } from 'chai';
import { isSystemMw } from '../../../../src/lib/http/middleware/is-system.js';

const sandbox = sinon.createSandbox();
const next = sandbox.stub();

beforeEach(() => {
	sandbox.resetHistory();
});

describe('rate limit middleware', () => {
	it('should set to "false" for requests without "systemkey" parameter', async () => {
		const ctx = { query: {} } as unknown as Context;
		await isSystemMw(ctx, next);
		expect(ctx['isSystem']).to.equal(false);
	});

	it('should set to "false" for requests with invalid "systemkey" parameter', async () => {
		const ctx = { query: { systemkey: 'wrongkey' } } as unknown as Context;
		await isSystemMw(ctx, next);
		expect(ctx['isSystem']).to.equal(false);
	});

	it('should set to "true" for requests with valid "systemkey" parameter', async () => {
		const ctx = { query: { systemkey: 'system' } } as unknown as Context;
		await isSystemMw(ctx, next);
		expect(ctx['isSystem']).to.equal(true);
	});
});
