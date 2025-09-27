import type Router from '@koa/router';
import createHttpError from 'http-errors';
import { RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible';
import { getAltIpsClient } from '../../lib/alt-ips-client.js';
import type { ExtendedContext } from '../../types.js';

export const rateLimiter = new RateLimiterMemory({
	points: 20,
	duration: 60,
});

export const checkRateLimit = async (ctx: ExtendedContext) => {
	const ip = ctx.request.ip;

	try {
		await rateLimiter.consume(ip);
	} catch (error) {
		if (error instanceof RateLimiterRes) {
			throw createHttpError(429, `Too many requests.`, { type: 'too_many_requests' });
		}

		throw createHttpError(500);
	}
};

const handle = async (ctx: ExtendedContext): Promise<void> => {
	const ip = ctx.request.ip;

	if (!ip) {
		throw createHttpError(400, 'Unable to get the requester IP.', { type: 'no_ip' });
	}

	await checkRateLimit(ctx);

	const token = await getAltIpsClient().generateToken(ip);
	ctx.body = { ip, token };
};

export const registerAlternativeIpRoute = (router: Router): void => {
	router.post('/alternative-ip', '/alternative-ip', handle);
};
