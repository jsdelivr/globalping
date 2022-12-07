import type {Context, Next} from 'koa';
import createHttpError from 'http-errors';
import newrelic from 'newrelic';
import {scopedLogger} from '../../logger.js';

const logger = scopedLogger('error-handler-mw');

export const errorHandlerMw = async (ctx: Context, next: Next) => {
	try {
		await next();
	} catch (error: unknown) {
		if (createHttpError.isHttpError(error)) {
			ctx.status = error.status;
			ctx.body = {
				error: {
					message: error.expose ? error.message : createHttpError(error.status).message,
					type: error['type'] as string ?? 'api_error',
				},
			};

			return;
		}

		if (error instanceof Error) {
			newrelic.noticeError(error);
		}

		logger.error(error);

		ctx.status = 500;
		ctx.body = {
			error: {
				message: 'Internal Server Error',
				type: 'api_error',
			},
		};
	}
};
