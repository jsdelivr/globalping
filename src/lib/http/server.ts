import {createServer} from 'node:http';
import Koa from 'koa';
import Router from '@koa/router';
import cors from '@koa/cors';
import responseTime from 'koa-response-time';
import {registerCreateMeasurementRoute} from '../../measurement/route/create-measurement.js';
import {registerGetMeasurementRoute} from '../../measurement/route/get-measurement.js';
import {registerGetProbesRoute} from '../../probe/route/get-probes.js';
import {errorHandler} from './error-handler.js';
import {rateLimitHandler} from './middleware/ratelimit.js';

const app = new Koa();
const router = new Router();

router.prefix('/v1');

// POST /measurements
registerCreateMeasurementRoute(router);
// GET /measurements/:id
registerGetMeasurementRoute(router);

// GET /probes
registerGetProbesRoute(router);

app
	.use(responseTime())
	.use(cors())
	.use(router.routes())
	.use(router.allowedMethods())
	.use(rateLimitHandler());

app.on('error', errorHandler);

const server = createServer(app.callback());

export const getHttpServer = () => server;
