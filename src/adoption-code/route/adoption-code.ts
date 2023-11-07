import type { Context } from 'koa';
import type Router from '@koa/router';
import type { AdoptionCodeRequest } from '../types.js';
import { bodyParser } from '../../lib/http/middleware/body-parser.js';
import { validate } from '../../lib/http/middleware/validate.js';
import { schema } from '../schema.js';
import { isSystem } from '../../lib/http/middleware/is-system.js';
import { codeSender } from '../sender.js';

const handle = async (ctx: Context): Promise<void> => {
	const request = ctx.request.body as AdoptionCodeRequest;
	const socket = await codeSender.sendCode(request);

	ctx.body = {
		uuid: socket.data.probe.uuid,
		version: socket.data.probe.version,
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
	router.post('/adoption-code', '/adoption-code', isSystem(), bodyParser(), validate(schema), handle);
};
