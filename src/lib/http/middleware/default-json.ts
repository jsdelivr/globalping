import type { ExtendedMiddleware } from '../../../types.js';
import createHttpError from 'http-errors';
import _ from 'lodash';

export const defaultJson = (): ExtendedMiddleware => async (ctx, next) => {
	await next();

	if (ctx.status >= 400 && !ctx.body) {
		const error = createHttpError(ctx.status);

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
