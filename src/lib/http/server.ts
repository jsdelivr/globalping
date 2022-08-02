import {createServer} from 'node:http';
import Koa from 'koa';
import json from 'koa-json';
import Router from '@koa/router';
import conditionalGet from 'koa-conditional-get';
import compress from 'koa-compress';
import etag from 'koa-etag';
import responseTime from 'koa-response-time';
import {registerGetProbesRoute} from '../../probe/route/get-probes.js';
import {registerGetMeasurementRoute} from '../../measurement/route/get-measurement.js';
import {registerCreateMeasurementRoute} from '../../measurement/route/create-measurement.js';
import {registerDemoRoute} from '../../demo/route/get.js';
import {errorHandler} from './error-handler.js';
// Import {rateLimitHandler} from './middleware/ratelimit.js';
import {errorHandlerMw} from './middleware/error-handler.js';
import {corsHandler} from './middleware/cors.js';
import {benchmark} from './middleware/benchmark.js';

const app = new Koa();

const rootRouter = new Router({strict: true, sensitive: true});
rootRouter.prefix('/');
// GET /
rootRouter.get('/', ctx => {
	ctx.status = 404;
	ctx.body = {
		type: 'docs',
		uri: 'https://github.com/jsdelivr/globalping/tree/master/docs',
	};
});

const apiRouter = new Router({strict: true, sensitive: true});
apiRouter.prefix('/v1');
// POST /measurements
registerCreateMeasurementRoute(apiRouter);
// GET /measurements/:id
registerGetMeasurementRoute(apiRouter);
// GET /probes
registerGetProbesRoute(apiRouter);

const demoRouter = new Router({strict: true, sensitive: true});
demoRouter.prefix('/demo');
// GET /demo
registerDemoRoute(demoRouter);

app
	.use(benchmark())
	.use(compress())
	.use(conditionalGet())
	.use(etag({weak: true}))
// Exclude root + demo routers from any checks
	.use(rootRouter.routes())
	.use(demoRouter.routes())
	// Error handler must always be the first middleware in a chain unless you know what you are doing ;)
	.use(errorHandlerMw)
	// .use(rateLimitHandler())
	.use(responseTime())
	.use(corsHandler())
	.use(json({pretty: true, spaces: 2}))
	.use(apiRouter.routes())
	.use(apiRouter.allowedMethods());

app.on('error', errorHandler);

const server = createServer(app.callback());

export const getHttpServer = () => server;
