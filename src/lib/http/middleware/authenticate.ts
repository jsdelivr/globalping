import config from 'config';
import { jwtVerify } from 'jose';
import apmAgent from 'elastic-apm-node';

import { type AccountRole, getAccountRole, getUserAccountId } from '../../accounts.js';
import { auth } from '../auth.js';
import { scopedLogger } from '../../logger.js';
import type { ExtendedMiddleware } from '../../../types.js';

const sessionConfig = config.get<AuthenticateOptions['session']>('server.session');
const logger = scopedLogger('authenticate');

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
	accountRole?: AccountRole;
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

const resolveAccount = async (ctx: Parameters<ExtendedMiddleware>[0], payload: SessionCookiePayload) => {
	const personal = { accountId: payload.user_account_id ?? null, accountRole: 'owner' as AccountRole };

	try {
		// PHASE5: drop the lookup. Directus puts the account in the cookie, but the sessions issued before that shipped stay
		// valid for a day, so until then it still has to be resolved here.
		personal.accountId ??= await getUserAccountId(payload.id!);
		const [ cookieUserId, activeAccountId ] = (ctx.cookies.get(sessionConfig.activeAccountCookieName) ?? '').split(':');

		if (
			// If who set the cookie doesn't match the requester => fallback to the requester's account.
			cookieUserId !== payload.id
			 || !activeAccountId
			 || activeAccountId === personal.accountId) {
			return personal;
		}

		// activeAccountId is a cookie set by dashboard FE so it is trusted, unlike user_account_id which is signed by the dashboard.
		const resolved = await getAccountRole(activeAccountId, payload.id!);

		return resolved
			? { accountId: resolved.id, accountRole: resolved.role }
			: personal;
	} catch (error) {
		logger.error('Failed to resolve the active account.', error);
		return personal;
	}
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

			ctx.state.user = { id: result.userId, accountId: result.accountId, username: result.username, userType: result.userType, scopes: result.scopes, authMode: 'token', hashedToken: result.hashedToken };
			apmAgent.setUserContext({ id: result.userId || 'anonymous-token', username: result.username || 'anonymous-token' });
		} else if (sessionCookie) {
			const payload = await verifySessionPayload(sessionCookie, sessionKey);

			if (payload?.id && payload.app_access === true) {
				const account = await resolveAccount(ctx, payload);
				ctx.state.user = { id: payload.id, ...account, username: payload.github_username || null, userType: payload.user_type || 'member', authMode: 'cookie', adminAccess: payload.admin_access === true };
				apmAgent.setUserContext({ id: payload.id, username: payload.github_username || `ID(${payload.id})` });
			}
		}

		await next();
	};
};
