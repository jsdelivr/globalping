import createHttpError from 'http-errors';
import koaBodyParser from 'koa-bodyparser';

export const bodyParser = () => koaBodyParser({
	enableTypes: [ 'json' ],
	jsonLimit: '100kb',
	onerror (error) {
		throw createHttpError(400, error.message);
	},
});
