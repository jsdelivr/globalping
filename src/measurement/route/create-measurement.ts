import config from 'config';
import type Router from '@koa/router';
import { getMeasurementRunner } from '../runner.js';
import { bodyParser } from '../../lib/http/middleware/body-parser.js';
import { corsAuthHandler } from '../../lib/http/middleware/cors.js';
import { validate } from '../../lib/http/middleware/validate.js';
import { authenticate } from '../../lib/http/middleware/authenticate.js';
import { schema } from '../schema/global-schema.js';
import type { ExtendedContext } from '../../types.js';

const hostConfig = config.get<string>('server.host');
const runner = getMeasurementRunner();

const handle = async (ctx: ExtendedContext): Promise<void> => {
	const { measurementId, probesCount } = await runner.run(ctx);

	ctx.status = 202;
	ctx.set('Location', `${hostConfig}/v1/measurements/${measurementId}`);

	ctx.body = {
		id: measurementId,
		probesCount,
	};
};

export const registerCreateMeasurementRoute = (router: Router): void => {
	router
		.options('/measurements', '/measurements', corsAuthHandler())
		.post('/measurements', '/measurements', authenticate, bodyParser(), validate(schema), handle);
};
