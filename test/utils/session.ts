import config from 'config';
import { SignJWT, type JWTPayload } from 'jose';
import type { AuthenticateOptions } from '../../src/lib/http/middleware/authenticate.js';

const sessionConfig = config.get<AuthenticateOptions['session']>('server.session');
const sessionKey = Buffer.from(sessionConfig.cookieSecret);

export const getSignedJwt = (options: JWTPayload) => new SignJWT(options)
	.setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(sessionKey);
