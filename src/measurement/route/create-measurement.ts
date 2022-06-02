import Joi from 'joi';
import config from 'config';
import type {Context} from 'koa';
import type Router from '@koa/router';
import {getMeasurementRunner} from '../runner.js';
import type {MeasurementRequest} from '../types.js';
import {bodyParser} from '../../lib/http/middleware/body-parser.js';
import {validate} from '../../lib/http/middleware/validate.js';
import {dnsSchema, pingSchema, tracerouteSchema, mtrSchema} from '../schema/command-schema.js';
import {schema as locationSchema} from '../schema/location-schema.js';

const runner = getMeasurementRunner();
const measurementConfig = config.get<{limits: {global: number; location: number}}>('measurement');

export const schema = Joi.object({
	locations: locationSchema,
	measurement: Joi.alternatives().try(pingSchema, tracerouteSchema, dnsSchema, mtrSchema).required(),
	limit: Joi.number().min(1).max(measurementConfig.limits.global),
});

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
