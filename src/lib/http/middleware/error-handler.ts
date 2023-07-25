import createHttpError from 'http-errors';
import newrelic from 'newrelic';
import { scopedLogger } from '../../logger.js';
import type { ExtendedMiddleware } from '../../../types';

const logger = scopedLogger('error-handler-mw');

export const errorHandlerMw: ExtendedMiddleware = async (ctx, next) => {
	try {
		await next();
	} catch (error: unknown) {
		if (createHttpError.isHttpError(error)) {
			ctx.status = error.status;

			ctx.body = {
				error: {
					type: error['type'] as string ?? 'api_error',
					message: error.expose ? error.message : `${createHttpError(error.status).message}.`,
				},
				links: {
					documentation: ctx.getDocsLink(),
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
				type: 'api_error',
				message: 'Internal Server Error.',
			},
			links: {
				documentation: ctx.getDocsLink(),
			},
		};
	}
};
