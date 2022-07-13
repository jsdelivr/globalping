import type {DefaultContext, DefaultState, ParameterizedContext} from 'koa';
import type Router from '@koa/router';
import {getMeasurementStore} from '../store.js';

const store = getMeasurementStore();

const handle = async (ctx: ParameterizedContext<DefaultState, DefaultContext & Router.RouterParamContext>): Promise<void> => {
	const {id} = ctx.params;

	if (!id) {
		ctx.status = 400;
		return;
	}

	const result = await store.getMeasurementResults(id);

	if (!result) {
		ctx.status = 404;
		return;
	}

	ctx.set('last-modified', (new Date(result.createdAt)).toISOString());

	ctx.body = {
		id: result.id,
		type: result.type,
		status: result.status,
		createdAt: result.createdAt,
		updatedAt: result.updatedAt,
		probesCount: result.probesCount,
		results: Object.values(result.results),
	};
};

export const registerGetMeasurementRoute = (router: Router): void => {
	router.get('/measurements/:id([a-zA-Z0-9]+)', handle);
};
