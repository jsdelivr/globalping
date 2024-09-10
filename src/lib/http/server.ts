import { createServer } from 'node:http';
import * as zlib from 'node:zlib';
import * as url from 'node:url';
import json from 'koa-json';
import Router from '@koa/router';
import conditionalGet from 'koa-conditional-get';
import compress from 'koa-compress';
import etag from 'koa-etag';
import responseTime from 'koa-response-time';
import koaFavicon from 'koa-favicon';
import koaStatic from 'koa-static';
import config from 'config';
import Koa from 'koa';
import { registerGetProbesRoute } from '../../probe/route/get-probes.js';
import { registerGetMeasurementRoute } from '../../measurement/route/get-measurement.js';
import { registerCreateMeasurementRoute } from '../../measurement/route/create-measurement.js';
import { registerSendCodeRoute } from '../../adoption-code/route/adoption-code.js';
import { registerHealthRoute } from '../../health/route/get.js';
import { registerSpecRoute } from './spec.js';
import { errorHandler } from './error-handler.js';
import { defaultJson } from './middleware/default-json.js';
import { errorHandlerMw } from './middleware/error-handler.js';
import { corsHandler } from './middleware/cors.js';
import { isAdminMw } from './middleware/is-admin.js';
import { isSystemMw } from './middleware/is-system.js';
import domainRedirect from './middleware/domain-redirect.js';
import { docsLink } from './middleware/docs-link.js';
import type { CustomContext } from '../../types.js';
import { registerAlternativeIpRoute } from '../../alternative-ip/route/alternative-ip.js';
import { registerLimitsRoute } from '../../limits/route/get-limits.js';

const app = new Koa();
const publicPath = url.fileURLToPath(new URL('.', import.meta.url)) + '/../../../public';
const docsHost = config.get<string>('server.docsHost');

const rootRouter = new Router({ strict: true, sensitive: true });
rootRouter.prefix('/');

// GET /
rootRouter.get<object, CustomContext>('/', '/', (ctx) => {
	ctx.status = 404;

	ctx.body = {
		links: {
			documentation: ctx.getDocsLink(),
		},
	};
});

const apiRouter = new Router({ strict: true, sensitive: true });

apiRouter.prefix('/v1')
	.use(isAdminMw)
	.use(isSystemMw);

// GET /spec.yaml
registerSpecRoute(apiRouter);
// POST /measurements
registerCreateMeasurementRoute(apiRouter);
// GET /measurements/:id
registerGetMeasurementRoute(apiRouter);
// GET /probes
registerGetProbesRoute(apiRouter);
// POST /send-code
registerSendCodeRoute(apiRouter);
// POST /alternative-ip
registerAlternativeIpRoute(apiRouter);
// GET /limits
registerLimitsRoute(apiRouter);

const healthRouter = new Router({ strict: true, sensitive: true });
// GET /health
registerHealthRoute(healthRouter);

app
	.use(responseTime())
	.use(domainRedirect())
	.use(koaFavicon(`${publicPath}/favicon.ico`))
	.use(compress({ br: { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4 } }, gzip: { level: 3 }, deflate: false }))
	.use(conditionalGet())
	.use(etag({ weak: true }))
	.use(json({ pretty: true, spaces: 2 }))
	.use(docsLink({ docsHost }))
	.use(defaultJson())
	// Error handler must always be the first middleware in a chain unless you know what you are doing ;)
	.use(errorHandlerMw)
	.use(corsHandler())
	.use(rootRouter.routes())
	.use(healthRouter.routes())
	.use(apiRouter.routes())
	.use(apiRouter.allowedMethods())
	.use(koaStatic(publicPath, { format: false }));

app.on('error', errorHandler);

// eslint-disable-next-line @typescript-eslint/no-misused-promises
const server = createServer(app.callback());

export const getHttpServer = () => server;
