import type {DefaultContext, DefaultState, ParameterizedContext} from 'koa';
import type Router from '@koa/router';
import {getMeasurementStore} from '../store.js';

const store = getMeasurementStore();

const handle = async (ctx: ParameterizedContext<DefaultState, DefaultContext & Router.RouterParamContext>) => {
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

	ctx.body = {
		id: result.id,
		type: result.type,
		status: result.status,
		created_at: result.createdAt,
		updated_at: result.updatedAt,
		results: Object.values(result.results).map(r => r),
	};
};

export const registerGetMeasurementRoute = (router: Router) => {
	router.get('/measurements/:id([a-zA-Z0-9]+)', handle);
};
