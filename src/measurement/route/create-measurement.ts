import type {Context} from 'koa';
import type Router from '@koa/router';
import {getMeasurementRunner} from '../runner.js';
import type {MeasurementRequest} from '../types.js';
import {bodyParser} from '../../lib/http/middleware/body-parser.js';
import {validate} from '../../lib/http/middleware/validate.js';
import {schema} from '../schema/global-schema.js';

const runner = getMeasurementRunner();

const handle = async (ctx: Context): Promise<void> => {
	const request = ctx.request.body as MeasurementRequest;
	const config = await runner.run(request);

	ctx.body = {
		id: config.id,
		probesCount: config.probes.length,
	};
};

export const registerCreateMeasurementRoute = (router: Router): void => {
	router.post('/measurements', bodyParser(), validate(schema), handle);
};
