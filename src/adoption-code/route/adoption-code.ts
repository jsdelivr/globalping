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
	const socket = await codeSender.sendCode(request);

	ctx.body = {
		uuid: socket.data.probe.uuid,
		version: socket.data.probe.version,
		isHardware: socket.data.probe.isHardware,
		hardwareDevice: socket.data.probe.hardwareDevice,
		status: socket.data.probe.status,
		city: socket.data.probe.location.city,
		state: socket.data.probe.location.state,
		country: socket.data.probe.location.country,
		latitude: socket.data.probe.location.latitude,
		longitude: socket.data.probe.location.longitude,
		asn: socket.data.probe.location.asn,
		network: socket.data.probe.location.network,
	};
};

export const registerSendCodeRoute = (router: Router): void => {
	router.post('/adoption-code', '/adoption-code', bodyParser(), validate(schema), handle);
};
