import fs from 'node:fs';
import path from 'node:path';
import type {DefaultContext, DefaultState, ParameterizedContext} from 'koa';
import type Router from '@koa/router';

const handle = async (ctx: ParameterizedContext<DefaultState, DefaultContext & Router.RouterParamContext>) => {
	const {file} = ctx.params;
	ctx.body = fs.readFileSync(path.join(path.resolve(), '/public/', file ?? 'index.html'), 'utf8');
};

export const registerDemoRoute = (router: Router) => {
	router.get('/demo/:file', handle);
	router.get('/demo/', handle);
};
