import type { DefaultContext, DefaultState, ParameterizedContext } from 'koa';
import type Router from '@koa/router';
import { getMeasurementStore } from '../store.js';
import { getMeasurementRateLimit } from '../../lib/rate-limiter/rate-limiter-get.js';
import createHttpError from 'http-errors';

const store = getMeasurementStore();

const handle = async (ctx: ParameterizedContext<DefaultState, DefaultContext & Router.RouterParamContext>): Promise<void> => {
	const { id } = ctx.params;

	if (!id) {
		ctx.status = 400;
		return;
	}

	const result = await store.getMeasurementString(id);

	if (!result) {
		throw createHttpError(404, `Couldn't find the requested item.`, { type: 'not_found' });
	}

	ctx.type = 'application/json';
	ctx.body = result;
};

export const registerGetMeasurementRoute = (router: Router): void => {
	router.get('/measurements/:id', '/measurements/:id([a-zA-Z0-9]+)', getMeasurementRateLimit, handle);
};
