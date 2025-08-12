import type { Context, Next } from 'koa';
import { validate as validateIP } from '../../malware/ip.js';
import createHttpError from 'http-errors';

export const blacklist = async (ctx: Context, next: Next) => {
	const ip = ctx.request.ip;

	if (!validateIP(ip)) {
		throw createHttpError(403, `Access from ${ip} has been forbidden for security reasons.`, { type: 'access_forbidden' });
	}

	await next();
};
