import type { ParameterizedContext } from 'koa';
import type Router from '@koa/router';

const handle = (options: ApiCatalogOptions) => (ctx: ParameterizedContext): void => {
	ctx.set('Content-Type', 'application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"; charset=utf-8');

	ctx.body = {
		linkset: [
			{
				'anchor': `${options.apiHost}/v1`,
				'service-desc': [
					{
						href: `${options.apiHost}/v1/spec.yaml`,
						type: 'application/yaml',
					},
				],
				'service-doc': [
					{
						href: `${options.docsHost}/docs/api.globalping.io`,
						type: 'text/html',
					},
				],
			},
		],
	};
};

export const registerApiCatalogRoute = (router: Router, options: ApiCatalogOptions): void => {
	router.get('/.well-known/api-catalog', handle(options));
};

export type ApiCatalogOptions = {
	apiHost: string;
	docsHost: string;
};
