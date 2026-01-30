import { getPostMeasurementRateLimitState } from '../../lib/rate-limiter/rate-limiter-post.js';
import type { ExtendedContext, ExtendedRouter } from '../../types.js';
import { credits } from '../../lib/credits.js';
import { authenticate } from '../../lib/http/middleware/authenticate.js';
import { corsAuthHandler } from '../../lib/http/middleware/cors.js';

const handle = async (ctx: ExtendedContext): Promise<void> => {
	const [ rateLimitState, remainingCredits ] = await Promise.all([
		getPostMeasurementRateLimitState(ctx),
		ctx.state.user?.id && credits.getRemainingCredits(ctx.state.user.id),
	]);

	ctx.body = {
		rateLimit: {
			measurements: {
				create: rateLimitState,
			},
		},
		...(ctx.state.user?.id && {
			credits: {
				remaining: remainingCredits,
			},
		}),
	};
};

export const registerLimitsRoute = (router: ExtendedRouter): void => {
	router.get('/limits', '/limits', corsAuthHandler(), authenticate(), handle);
};
