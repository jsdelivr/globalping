import type Koa from 'koa';
import type Router from '@koa/router';

export const docsLink = (options: DocsLinkOptions): DocsLinkMiddleware => async (ctx, next) => {
	ctx.getDocsLink = (routeName = ctx._matchedRouteName!, method = ctx.method === 'HEAD' ? 'GET' : ctx.method) => {
		return `${options.docsHost}/docs/api.globalping.io${getDocsPath(ctx.router, routeName, method)}`;
	};

	await next();
};

const getDocsPath = (router: Router<Koa.DefaultState, DocsLinkContext>, routeName: string | undefined, method: string) => {
	if (!routeName || routeName === '/') {
		return '';
	}

	const route = router.route(routeName);

	if (typeof route !== 'object' || !route.name) {
		throw new Error(`Unknown route ${routeName}.`);
	}

	return `#${method.toLowerCase()}-/v1${route.name.replace(/:(\w+)/g, '-$1-')}`;
};

export type DocsLinkOptions = { docsHost: string };
export type DocsLinkContext = { getDocsLink(routeName?: string, method?: string): string };
export type DocsLinkMiddleware = Router.Middleware<Koa.DefaultState, DocsLinkContext>;
