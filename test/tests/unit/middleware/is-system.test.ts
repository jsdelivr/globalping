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
	it('should set to "false" for requests without system key', async () => {
		const ctx = { headers: {} } as unknown as Context;
		await isSystemMw(ctx, next);
		expect(ctx['isSystem']).to.equal(false);
	});

	it('should set to "false" for requests with invalid system key', async () => {
		const ctx = { headers: { 'x-api-key': 'wrongkey' } } as unknown as Context;
		await isSystemMw(ctx, next);
		expect(ctx['isSystem']).to.equal(false);
	});

	it('should set to "true" for requests with valid system key', async () => {
		const ctx = { headers: { 'x-api-key': 'system' } } as unknown as Context;
		await isSystemMw(ctx, next);
		expect(ctx['isSystem']).to.equal(true);
	});
});
