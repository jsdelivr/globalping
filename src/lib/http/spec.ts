import type { Context } from 'koa';
import type Router from '@koa/router';

import _ from 'lodash';
import * as openApiCore from '@redocly/openapi-core';

const getYaml = async (): Promise<string> => {
	const bundled = await openApiCore.bundle({
		ref: 'public/v1/spec.yaml',
		config: await openApiCore.createConfig({}),
	});

	return openApiCore.stringifyYaml(bundled.bundle.parsed, {
		lineWidth: -1,
	});
};

const getYamlMemoized = _.memoize(getYaml);

const handle = async (ctx: Context): Promise<void> => {
	ctx.body = await (ctx.app.env === 'production' ? getYamlMemoized : getYaml)();
};

export const registerSpecRoute = (router: Router): void => {
	router.get('/spec.yaml', handle);
};
