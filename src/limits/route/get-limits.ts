import type Router from '@koa/router';
import { getRateLimitState } from '../../lib/rate-limiter/rate-limiter-post.js';
import type { ExtendedContext } from '../../types.js';
import { credits } from '../../lib/credits.js';
import { authenticate } from '../../lib/http/middleware/authenticate.js';
import { corsAuthHandler } from '../../lib/http/middleware/cors.js';

const handle = async (ctx: ExtendedContext): Promise<void> => {
	const [ rateLimitState, remainingCredits ] = await Promise.all([
		getRateLimitState(ctx),
		ctx.state.user?.id && credits.getRemainingCredits(ctx.state.user.id),
	]);

	ctx.body = {
		rateLimit: {
			measurements: {
				create: rateLimitState,
			},
		},
		...(ctx.state.user?.id && { credits: {
			remaining: remainingCredits,
		} }),
	};
};

export const registerLimitsRoute = (router: Router): void => {
	router.get('/limits', '/limits', corsAuthHandler(), authenticate(), handle);
};
