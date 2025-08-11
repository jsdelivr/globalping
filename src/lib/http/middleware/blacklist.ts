import type { Context, Next } from 'koa';
import { validate as validateIP } from '../../malware/ip.js';
import { validate as validateDomain } from '../../malware/domain.js';


function setBlacklistContext (ctx: Context, source: string) {
	ctx.status = 403;

	ctx.body = {
		error: {
			type: 'access_forbidden',
			message: `Access from ${source} has been forbidden for security reasons.`,
		},
	};
}

export const blacklist = async (ctx: Context, next: Next) => {
	const ip = ctx.request.ip;
	const hostname = ctx.request.hostname;

	if (!validateIP(ip)) {
		return setBlacklistContext(ctx, ip);
	}

	if (hostname && hostname !== ip && !validateDomain(hostname)) {
		return setBlacklistContext(ctx, hostname);
	}

	await next();
};
