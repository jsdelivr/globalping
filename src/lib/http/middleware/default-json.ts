import type { Context, Next } from 'koa';
import createHttpError from 'http-errors';
import _ from 'lodash';

export const defaultJson = () => async (ctx: Context, next: Next) => {
	await next();

	if (ctx.status >= 400 && !ctx.body) {
		const error = createHttpError(ctx.status);

		ctx.body = {
			error: {
				type: _.snakeCase(error.message),
				message: `${error.message}.`,
			},
		};
	}
};
