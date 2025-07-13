import { Context } from 'koa';
import koaBodyParser from 'koa-bodyparser';
import createHttpError from 'http-errors';
import { UnknownNext } from '../../../types.js';

export const bodyParser = () => {
	const parser = koaBodyParser({
		enableTypes: [ 'json' ],
		jsonLimit: '100kb',
		onerror (error) {
			throw createHttpError(400, error.message);
		},
	});

	return async (ctx: Context, next: UnknownNext) => {
		await parser(ctx, async () => {
			// Elastic APM expects this on the underlying request.
			(ctx.req as unknown as { body: unknown }).body = ctx.request.body;
			await next();
		});
	};
};
