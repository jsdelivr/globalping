import type {DefaultContext, DefaultState, ParameterizedContext} from 'koa';
import type Router from '@koa/router';
import cryptoRandomString from 'crypto-random-string';
import {getMeasurementStore} from '../store.js';
import {recordOnBenchmark} from '../../lib/benchmark/index.js';

const store = getMeasurementStore();

const handle = async (ctx: ParameterizedContext<DefaultState, DefaultContext & Router.RouterParamContext>): Promise<void> => {
	const rId = cryptoRandomString({length: 16, type: 'alphanumeric'});
	recordOnBenchmark({id: rId, type: 'get_measurement', action: 'start'});

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

	ctx.set('last-modified', (new Date(result.createdAt)).toUTCString());

	ctx.body = {
		id: result.id,
		type: result.type,
		status: result.status,
		completed: result.completed,
		createdAt: new Date(result.createdAt).toISOString(),
		updatedAt: new Date(result.updatedAt).toISOString(),
		probesCount: result.probesCount,
		results: Object.values(result.results),
	};

	recordOnBenchmark({id, type: 'get_measurement', action: 'end'});
};

export const registerGetMeasurementRoute = (router: Router): void => {
	router.get('/measurements/:id([a-zA-Z0-9]+)', handle);
};
