import type { Context, Next } from 'koa';
import { validate as validateIP } from '../../malware/ip.js';

export const blacklist = async (ctx: Context, next: Next) => {
	const ip = ctx.request.ip;

	if (!validateIP(ip)) {
		ctx.status = 403;

		ctx.body = {
			error: {
				type: 'access_forbidden',
				message: `Access from ${ip} has been forbidden for security reasons.`,
			},
		};

		return;
	}

	await next();
};
