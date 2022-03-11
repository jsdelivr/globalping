import {createServer} from 'node:http';
import Koa from 'koa';
import Router from '@koa/router';
import appsignal from '../appsignal.js';
import {registerCreateMeasurementRoute} from '../../measurement/route/create-measurement.js';
import {registerGetMeasurementRoute} from '../../measurement/route/get-measurement.js';

const app = new Koa();
const router = new Router();

router.prefix('/v1');

// POST /measurements
registerCreateMeasurementRoute(router);
// GET /measurements/:id
registerGetMeasurementRoute(router);

app
	.use(router.routes())
	.use(router.allowedMethods());

app.on('error', error => {
	appsignal.tracer().setError(error);
});

const server = createServer(app.callback());

export const getHttpServer = () => server;
