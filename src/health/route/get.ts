import type { DefaultContext, DefaultState, ParameterizedContext } from 'koa';
import type Router from '@koa/router';

import getTermListener from '../../lib/term-listener.js';

const handle = (ctx: ParameterizedContext<DefaultState, DefaultContext & Router.RouterParamContext>): void => {
	const isTerminating = getTermListener().getIsTerminating();
	ctx.body = isTerminating ? 'Received SIGTERM, shutting down' : 'Alive';
};

export const registerHealthRoute = (router: Router): void => {
	router.get('/health', '/health', handle);
};
