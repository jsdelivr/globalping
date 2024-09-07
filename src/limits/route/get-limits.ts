import type Router from '@koa/router';
import { getRateLimitState } from '../../lib/rate-limiter.js';
import type { ExtendedContext } from '../../types.js';

const handle = async (ctx: ExtendedContext): Promise<void> => {
	const rateLimitState = await getRateLimitState(ctx);
	ctx.body = rateLimitState;
};

export const registerLimitsRoute = (router: Router): void => {
	router.get('/limits', '/limits', handle);
};
