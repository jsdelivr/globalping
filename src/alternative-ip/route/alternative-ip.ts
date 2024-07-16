import type { Context } from 'koa';
import type Router from '@koa/router';
import requestIp from 'request-ip';
import createHttpError from 'http-errors';
import type { AlternativeIpRequest } from '../types.js';
import { bodyParser } from '../../lib/http/middleware/body-parser.js';
import { validate } from '../../lib/http/middleware/validate.js';
import { schema } from '../schema.js';
import { alternativeIps } from '../../lib/ws/server.js';

const handle = async (ctx: Context): Promise<void> => {
	const request = ctx.request.body as AlternativeIpRequest;

	const ip = requestIp.getClientIp(ctx.request);

	if (!ip) {
		throw createHttpError(400, 'Unable to get requester ip.', { type: 'no_ip' });
	}

	await alternativeIps.validateTokenFromHttp({
		socketId: request.socketId,
		token: request.token,
		ip,
	});

	ctx.body = '';
};

export const registerAlternativeIpRoute = (router: Router): void => {
	router.post('/alternative-ip', '/alternative-ip', bodyParser(), validate(schema), handle);
};
