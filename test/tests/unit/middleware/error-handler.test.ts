import createHttpError from 'http-errors';
import {expect} from 'chai';
import {errorHandlerMw} from '../../../../src/lib/http/middleware/error-handler.js';

describe('Error handler middleware', () => {
	it('should handle http errors', async () => {
		const ctx: any = {};
		await errorHandlerMw(ctx, () => {
			throw createHttpError(400, 'bad request');
		});

		expect(ctx.status).to.equal(400);
		expect(ctx.body).to.deep.equal({error: {message: 'bad request', type: 'api_error'}});
	});

	it('should handle http errors with expose=false', async () => {
		const ctx: any = {};
		await errorHandlerMw(ctx, () => {
			throw createHttpError(400, 'custom error message', {expose: false});
		});

		expect(ctx.status).to.equal(400);
		expect(ctx.body).to.deep.equal({error: {message: 'Bad Request', type: 'api_error'}});
	});

	it('should handle custom errors', async () => {
		const ctx: any = {};
		await errorHandlerMw(ctx, () => {
			throw new Error('custom error message');
		});

		expect(ctx.status).to.equal(500);
		expect(ctx.body).to.deep.equal({error: {message: 'Internal Server Error', type: 'api_error'}});
	});
});
