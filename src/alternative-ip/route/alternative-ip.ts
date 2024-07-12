import type { Context } from 'koa';
import type Router from '@koa/router';
import type { AlternativeIpRequest } from '../types.js';
import { bodyParser } from '../../lib/http/middleware/body-parser.js';
import { validate } from '../../lib/http/middleware/validate.js';
import { schema } from '../schema.js';
import { alternativeIps } from '../../lib/ws/server.js';

const handle = async (ctx: Context): Promise<void> => {
	const request = ctx.request.body as AlternativeIpRequest;
	await alternativeIps.validateTokenFromHttp(request);

	ctx.body = {
	};
};

export const registerAlternativeIpRoute = (router: Router): void => {
	router.post('/alternative-ip', '/alternative-ip', bodyParser(), validate(schema), handle);
};
