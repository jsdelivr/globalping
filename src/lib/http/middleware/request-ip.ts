import type { Middleware } from 'koa';
import { getIpFromRequest } from '../../client-ip.js';

export const requestIp = (): Middleware => async (ctx, next) => {
	ctx.request.ip = getIpFromRequest(ctx.req);
	await next();
};
