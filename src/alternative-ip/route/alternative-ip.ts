import type { Context } from 'koa';
import type Router from '@koa/router';
import createHttpError from 'http-errors';
import { getAltIpsClient } from '../../lib/alt-ips-client.js';

const handle = async (ctx: Context): Promise<void> => {
	const ip = ctx.request.ip;

	if (!ip) {
		throw createHttpError(400, 'Unable to get requester ip.', { type: 'no_ip' });
	}

	const token = await getAltIpsClient().generateToken(ip);
	ctx.body = { ip, token };
};

export const registerAlternativeIpRoute = (router: Router): void => {
	router.post('/alternative-ip', '/alternative-ip', handle);
};
