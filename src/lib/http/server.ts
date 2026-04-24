import { createServer } from 'node:http';
import * as zlib from 'node:zlib';
import * as url from 'node:url';
import apmAgent from 'elastic-apm-node';
import { koa as koaElasticUtils } from 'elastic-apm-utils';
import './apm-filter.js';
import json from 'koa-json';
import Router from '@koa/router';
import conditionalGet from 'koa-conditional-get';
import compress from 'koa-compress';
import responseTime from 'koa-response-time';
import koaFavicon from 'koa-favicon';
import koaStatic from 'koa-static';
import config from 'config';
import Koa from 'koa';

import { registerGetProbesRoute } from '../../probe/route/get-probes.js';
import { registerGetMeasurementRoute } from '../../measurement/route/get-measurement.js';
import { registerCreateMeasurementRoute } from '../../measurement/route/create-measurement.js';
import { registerSendCodeRoute } from '../../adoption/route/adoption-code.js';
import { registerHealthRoute } from '../../health/route/get.js';
import { registerSpecRoute } from './spec.js';
import { errorHandler } from './error-handler.js';
import { compressed } from './middleware/compressed.js';
import { defaultJson } from './middleware/default-json.js';
import { errorHandlerMw } from './middleware/error-handler.js';
import { corsHandler } from './middleware/cors.js';
import { etag } from './middleware/etag.js';
import { requestIp } from './middleware/request-ip.js';
import { defaultHeaders } from './middleware/default-headers.js';
import { isAdminMw } from './middleware/is-admin.js';
import { isSystemMw } from './middleware/is-system.js';
import { docsLink } from './middleware/docs-link.js';
import { CustomContext, CustomState } from '../../types.js';
import { registerAlternativeIpRoute } from '../../alternative-ip/route/alternative-ip.js';
import { registerLimitsRoute } from '../../limits/route/get-limits.js';
import { blacklist } from './middleware/blacklist.js';
import { registerGetProbeLogsRoute } from '../../probe/route/get-probe-logs.js';
import { captureMiddlewareChainSpan, captureMiddlewareSpan } from '../metrics.js';
import type { IoContext } from '../server.js';


const publicPath = url.fileURLToPath(new URL('.', import.meta.url)) + '/../../../public';
const docsHost = config.get<string>('server.docsHost');

export const getHttpServer = (ioContext: IoContext) => {
	const app = new Koa();

	const rootRouter = new Router({ strict: true, sensitive: true });

	rootRouter.prefix('/')
		.use(koaElasticUtils.middleware(apmAgent));

	// GET /
	rootRouter.get<object, CustomContext>('/', '/', (ctx) => {
		ctx.status = 404;

		ctx.body = {
			links: {
				documentation: ctx.getDocsLink(),
			},
		};
	});

	const apiRouter = new Router<CustomState, CustomContext>({ strict: true, sensitive: true });

	apiRouter.prefix('/v1')
		.use(koaElasticUtils.middleware(apmAgent, { prefix: '/v1' }))
		.use(isAdminMw)
		.use(isSystemMw);

	// GET /spec.yaml
	registerSpecRoute(apiRouter);
	// POST /measurements
	registerCreateMeasurementRoute(apiRouter, ioContext);
	// GET /measurements/:id
	registerGetMeasurementRoute(apiRouter);
	// GET /probes
	registerGetProbesRoute(apiRouter, ioContext);
	// GET /probes/:id/logs
	registerGetProbeLogsRoute(apiRouter, ioContext);
	// POST /send-code
	registerSendCodeRoute(apiRouter, ioContext);
	// POST /alternative-ip
	registerAlternativeIpRoute(apiRouter, ioContext);
	// GET /limits
	registerLimitsRoute(apiRouter);

	const healthRouter = new Router({ strict: true, sensitive: true });
	healthRouter.use(koaElasticUtils.middleware(apmAgent));

	// GET /health
	registerHealthRoute(healthRouter);

	app
		.use(requestIp())
		.use(responseTime())
		.use(defaultHeaders())
		.use(koaFavicon(`${publicPath}/favicon.ico`))
		.use(captureMiddlewareSpan(compress({ br: { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4 } }, gzip: { level: 3 }, deflate: false }), { name: 'compress' }))
		.use(conditionalGet())
		.use(captureMiddlewareSpan(etag(), { name: 'etag' }))
		.use(captureMiddlewareSpan(json({ pretty: true, spaces: 2 }), { name: 'json' }))
		.use(docsLink({ docsHost }))
		.use(defaultJson())
		// Error handler must always be the first middleware in a chain unless you know what you are doing ;)
		.use(errorHandlerMw)
		.use(corsHandler())
		.use(blacklist)
		.use(captureMiddlewareSpan(compressed(), { name: 'compressed' }))
		.use(captureMiddlewareChainSpan('route', 'custom'))
		.use(rootRouter.routes())
		.use(healthRouter.routes())
		.use(apiRouter.routes())
		.use(apiRouter.allowedMethods())
		.use(koaElasticUtils.middleware(apmAgent))
		.use(koaStatic(publicPath, {
			format: false,
			setHeaders: (res) => {
				res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=60, stale-if-error=86400');
			},
		}));

	app.on('error', errorHandler);

	// eslint-disable-next-line @typescript-eslint/no-misused-promises
	return createServer(app.callback());
};
