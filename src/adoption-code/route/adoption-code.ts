import type { Context } from 'koa';
import type Router from '@koa/router';
import createHttpError from 'http-errors';
import type { AdoptionCodeRequest } from '../types.js';
import { bodyParser } from '../../lib/http/middleware/body-parser.js';
import { validate } from '../../lib/http/middleware/validate.js';
import { schema } from '../schema.js';
import { codeSender } from '../sender.js';

const handle = async (ctx: Context): Promise<void> => {
	if (!ctx['isSystem']) {
		throw createHttpError(403, 'Forbidden', { type: 'access_forbidden' });
	}

	const request = ctx.request.body as AdoptionCodeRequest;
	const probe = await codeSender.sendCode(request);

	ctx.body = {
		uuid: probe.uuid,
		version: probe.version,
		nodeVersion: probe.nodeVersion,
		hardwareDevice: probe.hardwareDevice,
		status: probe.status,
		city: probe.location.city,
		state: probe.location.state,
		country: probe.location.country,
		latitude: probe.location.latitude,
		longitude: probe.location.longitude,
		asn: probe.location.asn,
		network: probe.location.network,
	};
};

export const registerSendCodeRoute = (router: Router): void => {
	router.post('/adoption-code', '/adoption-code', bodyParser(), validate(schema), handle);
};
