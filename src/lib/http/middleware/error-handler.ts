import apmAgent from 'elastic-apm-node';
import createHttpError from 'http-errors';
import { scopedLogger } from '../../logger.js';
import type { ExtendedMiddleware } from '../../../types.js';

const logger = scopedLogger('error-handler-mw');

export const errorHandlerMw: ExtendedMiddleware = async (ctx, next) => {
	try {
		await next();
	} catch (error: unknown) {
		apmAgent.addLabels({
			gpErrorType: (error as { type?: string } | undefined)?.type || 'api_error',
			gpErrorMessage: (error as Error | undefined)?.message,
		});

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

		logger.error('Internal server error:', error);

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
