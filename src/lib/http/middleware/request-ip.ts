import type { Context, Next } from 'koa';
import { getIpFromRequest } from '../../client-ip.js';

export const requestIp = () => async (ctx: Context, next: Next) => {
	ctx.request.ip = getIpFromRequest(ctx.req);
	await next();
};
