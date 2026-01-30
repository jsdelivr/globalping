import createHttpError from 'http-errors';
import type { AdoptionCodeRequest } from '../types.js';
import type { ExtendedContext, ExtendedRouter } from '../../types.js';
import { bodyParser } from '../../lib/http/middleware/body-parser.js';
import { validate } from '../../lib/http/middleware/validate.js';
import { schema } from '../schema.js';
import { codeSender } from '../sender.js';
import { AdoptedProbes } from '../../lib/override/adopted-probes.js';

const handle = async (ctx: ExtendedContext): Promise<void> => {
	if (!ctx['isSystem']) {
		throw createHttpError(403, 'Forbidden', { type: 'access_forbidden' });
	}

	const request = ctx.request.body as AdoptionCodeRequest;
	const probe = await codeSender.sendCode(request);

	ctx.body = AdoptedProbes.formatProbeAsDProbe(probe);
};

export const registerSendCodeRoute = (router: ExtendedRouter): void => {
	router.post('/adoption-code', '/adoption-code', bodyParser(), validate(schema), handle);
};
