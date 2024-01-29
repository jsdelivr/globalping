import { auth } from '../auth.js';
import type { ExtendedMiddleware } from '../../../types.js';

export const authenticate: ExtendedMiddleware = async (ctx, next) => {
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

		ctx.state['userId'] = userId;
	}

	return next();
};
