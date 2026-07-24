import type Koa from 'koa';

export const discoveryLinks = (options: DiscoveryLinksOptions): Koa.Middleware<DiscoveryLinksState> => async (ctx, next) => {
	await next();

	if (!ctx.state.isStaticFile) {
		ctx.append('Link', `<${options.apiHost}/v1/spec.yaml>; rel="service-desc"; type="application/yaml", <${options.docsHost}/docs/api.globalping.io>; rel="service-doc"; type="text/html"`);
	}
};

export type DiscoveryLinksOptions = {
	apiHost: string;
	docsHost: string;
};

export type DiscoveryLinksState = {
	isStaticFile?: boolean;
};
