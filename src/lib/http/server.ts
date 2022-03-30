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
import {rateLimitHandler} from './middleware/ratelimit.js';
import {errorHandlerMw} from './middleware/error-handler.js';

const app = new Koa();
const router = new Router();

router.prefix('/v1');

// POST /measurements
registerCreateMeasurementRoute(router);
// GET /measurements/:id
registerGetMeasurementRoute(router);

// GET /probes
registerGetProbesRoute(router);

const demoRouter = new Router();

demoRouter.prefix('/demo');

// GET /demo
registerDemoRoute(demoRouter);

app
// Exclude demo router from any checks
	.use(demoRouter.routes())
	// Error handler must always be the first middleware in a chain unless you know what you are doing ;)
	.use(errorHandlerMw)
	.use(rateLimitHandler())
	.use(responseTime())
	.use(cors())
	.use(json({pretty: false, param: 'pretty'}))
	.use(router.routes())
	.use(router.allowedMethods());

app.on('error', errorHandler);

const server = createServer(app.callback());

export const getHttpServer = () => server;
