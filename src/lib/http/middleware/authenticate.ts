import type { Context, Next } from 'koa';
import { auth } from '../auth.js';

export const authenticate = async (ctx: Context, next: Next) => {
	const { headers } = ctx.request;

	if (headers && headers.authorization) {
		const parts = headers.authorization.split(' ');

		if (parts.length !== 2 || parts[0] !== 'Bearer') {
			ctx.status = 401;
			return;
		}

		const token = parts[1]!;
		const origin = ctx.get('Origin');
		const userId = await auth.validate(token, origin);

		if (!userId) {
			ctx.status = 401;
			return;
		}

		ctx['auth'] = userId;
	}

	return next();
};
