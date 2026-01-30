import { IncomingMessage } from 'node:http';
import type { Middleware } from 'koa';
import koaBodyParser from 'koa-bodyparser';
import createHttpError from 'http-errors';

interface RequestWithBody extends IncomingMessage {
	body?: unknown;
}

export const bodyParser = (): Middleware => {
	const parser = koaBodyParser({
		enableTypes: [ 'json' ],
		jsonLimit: '100kb',
		onerror (error) {
			throw createHttpError(400, error.message);
		},
	});

	return async (ctx, next) => {
		await parser(ctx, async () => {
			// Elastic APM expects this on the underlying request.
			(ctx.req as RequestWithBody).body = ctx.request.body;
			await next();
		});
	};
};
