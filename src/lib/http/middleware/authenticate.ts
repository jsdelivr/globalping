import { jwtVerify } from 'jose';

import { auth } from '../auth.js';
import type { ExtendedMiddleware } from '../../../types.js';

type SessionCookiePayload = {
	id?: string;
	role?: string;
	app_access?: number;
	admin_access?: number;
};

export const authenticate = (options: AuthenticateOptions): ExtendedMiddleware => {
	const sessionKey = Buffer.from(options.session.cookieSecret);

	return async (ctx, next) => {
		const authorization = ctx.headers.authorization;
		const sessionCookie = ctx.cookies.get(options.session.cookieName);

		if (authorization) {
			const parts = authorization.split(' ');

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

			ctx.state.user = { id: userId, authMode: 'token' };
		} else if (sessionCookie) {
			try {
				const result = await jwtVerify<SessionCookiePayload>(sessionCookie, sessionKey);

				if (result.payload.id && result.payload.app_access) {
					ctx.state.user = { id: result.payload.id, authMode: 'cookie' };
				}
			} catch {}
		}

		return next();
	};
};

export type AuthenticateOptions = { session: { cookieName: string, cookieSecret: string } };
export type AuthenticateState = { user?: { id: string, authMode: 'cookie' | 'token' } };

