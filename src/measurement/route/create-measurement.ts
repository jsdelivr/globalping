import config from 'config';
import type { Context } from 'koa';
import type Router from '@koa/router';
import { getMeasurementRunner } from '../runner.js';
import { bodyParser } from '../../lib/http/middleware/body-parser.js';
import { corsAuthHandler } from '../../lib/http/middleware/cors.js';
import { validate } from '../../lib/http/middleware/validate.js';
import { schema } from '../schema/global-schema.js';

const hostConfig = config.get<string>('server.host');
const runner = getMeasurementRunner();

const handle = async (ctx: Context): Promise<void> => {
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
		.post('/measurements', '/measurements', bodyParser(), validate(schema), handle);
};
