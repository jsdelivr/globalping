import type { Context, Next } from 'koa';
import { auth } from '../auth.js';

export const isAuthenticatedMw = async (ctx: Context, next: Next) => {
	const { headers } = ctx.request;

	if (headers && headers.authorization) {
		const parts = headers.authorization.split(' ');

		if (parts.length !== 2 || parts[0] !== 'Bearer') {
			ctx.status = 401;
			return;
		}

		const origin = ctx.get('Origin');
		const isValid = await auth.validate(parts[1]!, origin);

		if (!isValid) {
			ctx.status = 401;
			return;
		}

		ctx['isAuthenticated'] = true;
	}

	return next();
};
