import config from 'config';
import { jwtVerify } from 'jose';
import apmAgent from 'elastic-apm-node';

import { getUserAccountId, isAccountAvailable } from '../../accounts.js';
import { auth } from '../auth.js';
import type { ExtendedMiddleware } from '../../../types.js';

const sessionConfig = config.get<AuthenticateOptions['session']>('server.session');

type SessionCookiePayload = {
	id?: string;
	role?: string;
	app_access?: boolean;
	admin_access?: boolean;
	github_username?: string;
	user_type?: 'member' | 'sponsor' | 'special';
	user_account_id?: string;
};

export type AuthenticateOptions = {
	session: {
		cookieName: string;
		activeAccountCookieName: string;
		cookieSecret: string;
	};
};

export type AuthenticateStateUser = {
	id: string | null;
	accountId: string | null;
	username: string | null;
	userType: 'member' | 'sponsor' | 'special';
	scopes?: string[];
	hashedToken?: string;
	authMode: 'cookie' | 'token';
	adminAccess?: boolean;
};

export type AuthenticateState = {
	user?: AuthenticateStateUser;
};

const resolveAccountId = async (ctx: Parameters<ExtendedMiddleware>[0], payload: SessionCookiePayload): Promise<string | null> => {
	// PHASE5: drop the lookup. Directus puts the account in the cookie, but the sessions issued before that shipped stay
	// valid for a day, so until then it still has to be resolved here.
	const userAccountId = payload.user_account_id ?? await getUserAccountId(payload.id!);
	const activeAccountId = ctx.cookies.get(sessionConfig.activeAccountCookieName);

	// user_account_id is trusted as it is signed by the dashboard, unlike the activeAccountId which is a cookie set by dashboard FE.
	if (!activeAccountId || activeAccountId === userAccountId) {
		return userAccountId;
	}

	return await isAccountAvailable(activeAccountId, payload.id!) ? activeAccountId : userAccountId;
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

			ctx.state.user = { id: result.userId, accountId: result.accountId, username: result.username, userType: result.userType, scopes: result.scopes, authMode: 'token', hashedToken: result.hashedToken };
			apmAgent.setUserContext({ id: result.userId || 'anonymous-token', username: result.username || 'anonymous-token' });
		} else if (sessionCookie) {
			try {
				const result = await jwtVerify<SessionCookiePayload>(sessionCookie, sessionKey);
				const adminAccess = typeof result.payload.admin_access === 'boolean' ? result.payload.admin_access : false;
				const appAccess = typeof result.payload.app_access === 'boolean' ? result.payload.app_access : false;

				if (result.payload.id && appAccess) {
					const accountId = await resolveAccountId(ctx, result.payload);
					ctx.state.user = { id: result.payload.id, accountId, username: result.payload.github_username || null, userType: result.payload.user_type || 'member', authMode: 'cookie', adminAccess };
					apmAgent.setUserContext({ id: result.payload.id, username: result.payload.github_username || `ID(${result.payload.id})` });
				}
			} catch {}
		}

		await next();
	};
};
