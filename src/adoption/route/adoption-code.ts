import type { Context } from 'koa';
import type Router from '@koa/router';
import createHttpError from 'http-errors';
import type { AdoptionCodeRequest } from '../types.js';
import { bodyParser } from '../../lib/http/middleware/body-parser.js';
import { validate } from '../../lib/http/middleware/validate.js';
import { schema } from '../schema.js';
import { codeSender } from '../sender.js';
import { AdoptedProbes } from '../../lib/override/adopted-probes.js';

const handle = async (ctx: Context): Promise<void> => {
	if (!ctx['isSystem']) {
		throw createHttpError(403, 'Forbidden', { type: 'access_forbidden' });
	}

	const request = ctx.request.body as AdoptionCodeRequest;
	const probe = await codeSender.sendCode(request);

	ctx.body = AdoptedProbes.formatProbeAsDProbe(probe);
};

export const registerSendCodeRoute = (router: Router): void => {
	router.post('/adoption-code', '/adoption-code', bodyParser(), validate(schema), handle);
};
