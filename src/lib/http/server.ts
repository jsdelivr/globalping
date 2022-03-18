import {createServer} from 'node:http';
import Koa from 'koa';
import Router from '@koa/router';
import cors from '@koa/cors';
import appsignal from '../appsignal.js';
import {registerCreateMeasurementRoute} from '../../measurement/route/create-measurement.js';
import {registerGetMeasurementRoute} from '../../measurement/route/get-measurement.js';
import {registerGetProbesRoute} from '../../probe/route/get-probes.js';
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
	.use(rateLimitHandler)
	.use(cors())
	.use(router.routes())
	.use(router.allowedMethods());

app.on('error', error => {
	appsignal.tracer().setError(error);
});

const server = createServer(app.callback());

export const getHttpServer = () => server;
