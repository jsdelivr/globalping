import type { ExtendedMiddleware } from '../../../types.js';
import createHttpError from 'http-errors';
import _ from 'lodash';

export const defaultJson = (): ExtendedMiddleware => async (ctx, next) => {
	await next();

	if (ctx.status >= 400 && !ctx.body) {
		const error = createHttpError(ctx.status);

		// Fix a bit of koa's magic: setting the body below resets the status
		// to 200 if it wasn't explicitly set before.
		// eslint-disable-next-line no-self-assign
		ctx.status = ctx.status;

		ctx.body = {
			error: {
				type: _.snakeCase(error.message),
				message: `${error.message}.`,
			},
			links: {
				documentation: ctx.getDocsLink(),
			},
		};
	}
};
