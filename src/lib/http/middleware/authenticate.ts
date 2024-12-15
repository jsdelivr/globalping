import config from 'config';
import { jwtVerify } from 'jose';
import apmAgent from 'elastic-apm-node';

import { auth } from '../auth.js';
import type { ExtendedMiddleware } from '../../../types.js';

const sessionConfig = config.get<AuthenticateOptions['session']>('server.session');

type SessionCookiePayload = {
	id?: string;
	role?: string;
	app_access?: number;
	admin_access?: number;
};

export const authenticate = (): ExtendedMiddleware => {
	const sessionKey = Buffer.from(sessionConfig.cookieSecret);

	return async (ctx, next) => {
		const authorization = ctx.headers.authorization;
		const sessionCookie = ctx.cookies.get(sessionConfig.cookieName);

		if (authorization) {
			const parts = authorization.split(' ');

			if (parts.length !== 2 || parts[0] !== 'Bearer') {
				ctx.status = 401;
				return;
			}

			const token = parts[1]!;
			const origin = ctx.get('Origin');
			const result = await auth.validate(token, origin);

			if (!result) {
				ctx.status = 401;
				return;
			}

			ctx.state.user = { id: result.userId, scopes: result.scopes, authMode: 'token', hashedToken: result.hashedToken };
			apmAgent.setUserContext({ id: result.userId || 'anonymous-token' });
		} else if (sessionCookie) {
			try {
				const result = await jwtVerify<SessionCookiePayload>(sessionCookie, sessionKey);

				if (result.payload.id && result.payload.app_access) {
					ctx.state.user = { id: result.payload.id, authMode: 'cookie' };
					apmAgent.setUserContext({ id: result.payload.id });
				}
			} catch {}
		}

		return next();
	};
};

export type AuthenticateOptions = { session: { cookieName: string, cookieSecret: string } };
export type AuthenticateState = { user?: { id: string | undefined, scopes?: string[], hashedToken?: string, authMode: 'cookie' | 'token' } };
