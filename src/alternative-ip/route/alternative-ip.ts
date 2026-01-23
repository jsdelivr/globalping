import type Router from '@koa/router';
import apmAgent from 'elastic-apm-node';
import createHttpError from 'http-errors';
import { RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible';
import { getAltIpsClient } from '../../lib/alt-ips-client.js';
import { bodyParser } from '../../lib/http/middleware/body-parser.js';
import { validate } from '../../lib/http/middleware/validate.js';
import { schema } from '../schema.js';
import type { ExtendedContext } from '../../types.js';

const rateLimiter = new RateLimiterMemory({
	points: 20,
	duration: 60,
});

const checkRateLimit = async (ctx: ExtendedContext) => {
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
	const body = ctx.request.body as { localAddress?: string };
	const localAddress = typeof body?.localAddress === 'string' ? body.localAddress : undefined;

	if (localAddress) {
		apmAgent.addLabels({ gpProbeLocalAddress: localAddress });
	}

	if (!ip) {
		throw createHttpError(400, 'Unable to get the requester IP.', { type: 'no_ip' });
	}

	await checkRateLimit(ctx);

	const token = await getAltIpsClient().generateToken(ip);
	ctx.body = { ip, token };
};

export const registerAlternativeIpRoute = (router: Router): void => {
	router.post('/alternative-ip', '/alternative-ip', bodyParser(), validate(schema), handle);
};
