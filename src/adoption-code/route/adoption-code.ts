import type { Context } from 'koa';
import type Router from '@koa/router';
import type { AdoptionCodeRequest } from '../types.js';
import { bodyParser } from '../../lib/http/middleware/body-parser.js';
import { validate } from '../../lib/http/middleware/validate.js';
import { schema } from '../schema.js';
import { onlyAdmin } from '../../lib/http/middleware/only-admin.js';
import { codeSender } from '../sender.js';

const handle = async (ctx: Context): Promise<void> => {
	const request = ctx.request.body as AdoptionCodeRequest;
	const result = await codeSender.sendCode(request);

	ctx.body = {
		result,
	};
};

export const registerSendCodeRoute = (router: Router): void => {
	router.post('/adoption-code', '/adoption-code', onlyAdmin(), bodyParser(), validate(schema), handle);
};
