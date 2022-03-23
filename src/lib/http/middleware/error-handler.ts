import type {Context, Next} from 'koa';
import createHttpError from 'http-errors';
import appsignal from '../../appsignal.js';

export const errorHandlerMw = async (ctx: Context, next: Next) => {
	try {
		await next();
	} catch (error: unknown) {
		if (createHttpError.isHttpError(error)) {
			ctx.status = error.status;
			ctx.body = {
				error: {
					message: error.expose ? error.message : createHttpError(error.status).message,
					type: 'api_error',
				},
			};

			return;
		}

		if (error instanceof Error) {
			appsignal.tracer().setError(error);
		}

		ctx.status = 500;
		ctx.body = {
			error: {
				message: 'Internal Server Error',
				type: 'api_error',
			},
		};
	}
};
