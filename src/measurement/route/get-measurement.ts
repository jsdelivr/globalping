import type { DefaultContext, DefaultState, ParameterizedContext } from 'koa';
import type Router from '@koa/router';
import { getMeasurementStore } from '../store.js';

const store = getMeasurementStore();

const handle = async (ctx: ParameterizedContext<DefaultState, DefaultContext & Router.RouterParamContext>): Promise<void> => {
	const { id } = ctx.params;

	if (!id) {
		ctx.status = 400;
		return;
	}

	const result = await store.getMeasurementString(id);

	if (!result) {
		ctx.status = 404;
		return;
	}

	ctx.type = 'application/json';
	ctx.body = result;
};

export const registerGetMeasurementRoute = (router: Router): void => {
	router.get('/measurements/:id', '/measurements/:id([a-zA-Z0-9]+)', handle);
};
