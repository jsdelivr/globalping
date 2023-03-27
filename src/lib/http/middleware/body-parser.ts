import createHttpError from 'http-errors';
import koaBodyParser from 'koa-bodyparser';

export const bodyParser = () => koaBodyParser({
	onerror (error) {
		throw createHttpError(400, error.message);
	},
});
