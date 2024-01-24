import type { Context, Next } from 'koa';
import { auth } from '../auth.js';

export const isAuthenticatedMw = async (ctx: Context, next: Next) => {
	const { header } = ctx.request;

	if (header && header.authorization) {
		const parts = header.authorization.split(' ');

		if (parts.length !== 2 || parts[0] !== 'Bearer') {
			ctx.status = 401;
			return;
		}

		const isValid = await auth.validate(parts[1]!);

		if (!isValid) {
			ctx.status = 401;
			return;
		}

		ctx['isAuthenticated'] = true;
	}

	return next();
};
