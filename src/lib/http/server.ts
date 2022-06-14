import {createServer} from 'node:http';
import Koa from 'koa';
import json from 'koa-json';
import cors from '@koa/cors';
import Router from '@koa/router';
import responseTime from 'koa-response-time';
import {registerGetProbesRoute} from '../../probe/route/get-probes.js';
import {registerGetMeasurementRoute} from '../../measurement/route/get-measurement.js';
import {registerCreateMeasurementRoute} from '../../measurement/route/create-measurement.js';
import {registerDemoRoute} from '../../demo/route/get.js';
import {errorHandler} from './error-handler.js';
// Import {rateLimitHandler} from './middleware/ratelimit.js';
import {errorHandlerMw} from './middleware/error-handler.js';

const app = new Koa();

const rootRouter = new Router();
rootRouter.prefix('/');

rootRouter.get('/', ctx => {
	ctx.status = 404;
	ctx.body = {
		type: 'docs',
		uri: 'https://github.com/jsdelivr/globalping/tree/master/docs',
	};
});

const apiRouter = new Router();
apiRouter.prefix('/v1');

// POST /measurements
registerCreateMeasurementRoute(apiRouter);
// GET /measurements/:id
registerGetMeasurementRoute(apiRouter);

// GET /probes
registerGetProbesRoute(apiRouter);

const demoRouter = new Router();

demoRouter.prefix('/demo');

// GET /demo
registerDemoRoute(demoRouter);

app
// Exclude root + demo routers from any checks
	.use(rootRouter.routes())
	.use(demoRouter.routes())
	// Error handler must always be the first middleware in a chain unless you know what you are doing ;)
	.use(errorHandlerMw)
	// .use(rateLimitHandler())
	.use(responseTime())
	.use(cors())
	.use(json({pretty: false, param: 'pretty'}))
	.use(apiRouter.routes())
	.use(apiRouter.allowedMethods());

app.on('error', errorHandler);

const server = createServer(app.callback());

export const getHttpServer = () => server;
