import config from 'config';
import { jwtVerify } from 'jose';
import apmAgent from 'elastic-apm-node';

import { type AccountRole, getUserAccountId } from '../../accounts.js';
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
	active_account_id?: string;
	active_account_role?: AccountRole;
};

export type AuthenticateOptions = {
	session: {
		cookieName: string;
		cookieSecret: string;
	};
};

export type AuthenticateStateUser = {
	id: string | null;
	accountId: string | null;
	accountRole: AccountRole | null;
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

const resolveAccount = async (payload: SessionCookiePayload): Promise<{ accountId: string | null; accountRole: AccountRole }> => {
	if (payload.active_account_id && payload.active_account_role) {
		return { accountId: payload.active_account_id, accountRole: payload.active_account_role };
	}

	return { accountId: payload.user_account_id ?? await getUserAccountId(payload.id!), accountRole: 'owner' };
};

export const verifySessionPayload = async (cookie: string, key: Uint8Array): Promise<SessionCookiePayload | undefined> => {
	try {
		return (await jwtVerify<SessionCookiePayload>(cookie, key)).payload;
	} catch {
		return undefined;
	}
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

			ctx.state.user = { id: result.userId, accountId: result.accountId, accountRole: result.accountRole, username: result.username, userType: result.userType, scopes: result.scopes, authMode: 'token', hashedToken: result.hashedToken };
			apmAgent.setUserContext({ id: result.userId || 'anonymous-token', username: result.username || 'anonymous-token' });
		} else if (sessionCookie) {
			const payload = await verifySessionPayload(sessionCookie, sessionKey);

			if (payload?.id && payload.app_access === true) {
				// PHASE5: remove resolveAccount, read the two claims directly. The sessions issued before Directus
				// put the account in the cookie stay valid for a day, so until then it is resolved here.
				const account = await resolveAccount(payload);
				ctx.state.user = { id: payload.id, ...account, username: payload.github_username || null, userType: payload.user_type || 'member', authMode: 'cookie', adminAccess: payload.admin_access === true };
				apmAgent.setUserContext({ id: payload.id, username: payload.github_username || `ID(${payload.id})` });
			}
		}

		await next();
	};
};
