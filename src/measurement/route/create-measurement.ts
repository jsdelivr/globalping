import config from 'config';
import createHttpError from 'http-errors';
import type { IoContext } from '../../lib/server.js';
import { bodyParser } from '../../lib/http/middleware/body-parser.js';
import { corsAuthHandler } from '../../lib/http/middleware/cors.js';
import { validate } from '../../lib/http/middleware/validate.js';
import { authenticate } from '../../lib/http/middleware/authenticate.js';
import { schema } from '../schema/global-schema.js';
import type { ExtendedContext, ExtendedRouter } from '../../types.js';

const hostConfig = config.get<string>('server.host');

export const registerCreateMeasurementRoute = (router: ExtendedRouter, ioContext: IoContext): void => {
	const handle = async (ctx: ExtendedContext): Promise<void> => {
		if (!ctx.state.user?.adminAccess && ctx.state.user?.accountRole && ![ 'owner', 'member', 'admin' ].includes(ctx.state.user.accountRole)) {
			throw createHttpError(403, 'Your role in the selected organization does not allow you to run measurements.', { type: 'insufficient_permissions' });
		}

		const { measurementId, probesCount } = await ioContext.measurementRunner.run(ctx);

		ctx.status = 202;
		ctx.set('Location', `${hostConfig}/v1/measurements/${measurementId}`);

		ctx.body = {
			id: measurementId,
			probesCount,
		};
	};

	router
		.post('/measurements', '/measurements', corsAuthHandler(), authenticate(), bodyParser(), validate(schema), handle)
		.options('/measurements', '/measurements', corsAuthHandler());
};
