import apmAgent from 'elastic-apm-node';
import createHttpError from 'http-errors';
import { RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible';
import type { IoContext } from '../../lib/server.js';
import { bodyParser } from '../../lib/http/middleware/body-parser.js';
import { validate } from '../../lib/http/middleware/validate.js';
import { schema } from '../schema.js';
import type { ExtendedContext, ExtendedRouter } from '../../types.js';

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

export const registerAlternativeIpRoute = (router: ExtendedRouter, ioContext: IoContext): void => {
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

		const token = await ioContext.altIpsClient.generateToken(ip);
		ctx.body = { ip, token };
	};

	router.post('/alternative-ip', '/alternative-ip', bodyParser(), validate(schema), handle);
};
