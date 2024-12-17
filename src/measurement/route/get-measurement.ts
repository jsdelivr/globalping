import type { DefaultContext, DefaultState, ParameterizedContext } from 'koa';
import type Router from '@koa/router';
import apmAgent from 'elastic-apm-node';
import createHttpError from 'http-errors';
import { getMeasurementStore } from '../store.js';
import { getMeasurementRateLimit } from '../../lib/rate-limiter/rate-limiter-get.js';

const store = getMeasurementStore();

const handle = async (ctx: ParameterizedContext<DefaultState, DefaultContext & Router.RouterParamContext>): Promise<void> => {
	const { id } = ctx.params;

	if (!id) {
		ctx.status = 400;
		return;
	}

	const result = await store.getMeasurementString(id);
	apmAgent.addLabels({ gpMeasurementId: id });

	if (!result) {
		throw createHttpError(404, `Couldn't find the requested measurement.`, { type: 'not_found' });
	}

	ctx.type = 'application/json';
	ctx.body = result;
};

export const registerGetMeasurementRoute = (router: Router): void => {
	router.get('/measurements/:id', '/measurements/:id([a-zA-Z0-9]+)', getMeasurementRateLimit, handle);
};
