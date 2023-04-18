import { createServer } from 'node:http';
import * as zlib from 'node:zlib';
import * as url from 'node:url';
import json from 'koa-json';
import Router from '@koa/router';
import conditionalGet from 'koa-conditional-get';
import compress from 'koa-compress';
import etag from 'koa-etag';
import responseTime from 'koa-response-time';
import koaStatic from 'koa-static';
import cjsDependencies from '../../cjs-dependencies.cjs';
import { registerGetProbesRoute } from '../../probe/route/get-probes.js';
import { registerGetMeasurementRoute } from '../../measurement/route/get-measurement.js';
import { registerCreateMeasurementRoute } from '../../measurement/route/create-measurement.js';
import { registerHealthRoute } from '../../health/route/get.js';
import { errorHandler } from './error-handler.js';
import { rateLimitHandler } from './middleware/ratelimit.js';
import { errorHandlerMw } from './middleware/error-handler.js';
import { corsHandler } from './middleware/cors.js';
import { isAdminMw } from './middleware/is-admin.js';
import domainRedirect from './middleware/domain-redirect.js';

const app = new cjsDependencies.Koa();

const rootRouter = new Router({ strict: true, sensitive: true });
rootRouter.prefix('/');

// GET /
rootRouter.get('/', (ctx) => {
	ctx.status = 404;

	ctx.body = {
		type: 'docs',
		uri: 'https://github.com/jsdelivr/globalping/tree/master/docs',
	};
});

const apiRouter = new Router({ strict: true, sensitive: true });

apiRouter.prefix('/v1')
	.use(isAdminMw)
	.use(rateLimitHandler());

// POST /measurements
registerCreateMeasurementRoute(apiRouter);
// GET /measurements/:id
registerGetMeasurementRoute(apiRouter);
// GET /probes
registerGetProbesRoute(apiRouter);

const healthRouter = new Router({ strict: true, sensitive: true });
// GET /health
registerHealthRoute(healthRouter);

app
	.use(responseTime())
	.use(domainRedirect())
	.use(compress({ br: { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4 } }, gzip: { level: 3 }, deflate: false }))
	.use(conditionalGet())
	.use(etag({ weak: true }))
	.use(json({ pretty: true, spaces: 2 }))
	// Error handler must always be the first middleware in a chain unless you know what you are doing ;)
	.use(errorHandlerMw)
	.use(corsHandler())
	.use(rootRouter.routes())
	.use(healthRouter.routes())
	.use(apiRouter.routes())
	.use(apiRouter.allowedMethods())
	.use(koaStatic(url.fileURLToPath(new URL('.', import.meta.url)) + '/../../../public', { format: false }));

app.on('error', errorHandler);

// eslint-disable-next-line @typescript-eslint/no-misused-promises
const server = createServer(app.callback());

export const getHttpServer = () => server;
