import Joi from 'joi';
import type {Context} from 'koa';
import type Router from '@koa/router';
import bodyParser from 'koa-bodyparser';
import geoLists from 'countries-list';
import {getMeasurementRunner} from '../runner.js';
import type {MeasurementRequest} from '../types.js';
import {states} from '../../lib/location/states.js';
import {regions} from '../../lib/location/regions.js';
import {validate} from '../../lib/http/middleware/validate.js';
import {pingSchema, tracerouteSchema} from '../schema/command-schema.js';

const runner = getMeasurementRunner();
const {continents, countries} = geoLists;

// Todo: better validation. hostname/ip validation for targets
const schema = Joi.object({
	locations: Joi.array().items(Joi.object({
		type: Joi.string().valid('continent', 'region', 'country', 'state', 'city', 'asn').required(),
		value: Joi.alternatives().conditional('type', {
			switch: [
				{is: 'continent', then: Joi.string().valid(...Object.keys(continents))},
				{is: 'region', then: Joi.string().valid(...Object.keys(regions))},
				{is: 'country', then: Joi.string().valid(...Object.keys(countries))},
				{is: 'state', then: Joi.string().valid(...Object.keys(states))},
				{is: 'city', then: Joi.number()},
				{is: 'asn', then: Joi.number()},
			],
		}).required(),
		limit: Joi.number().min(1).max(50).when(Joi.ref('/limit'), {
			is: Joi.exist(),
			then: Joi.forbidden().messages({'any.unknown': 'limit per location is not allowed when a global limit is set'}),
			otherwise: Joi.required().messages({'any.required': 'limit per location required when no global limit is set'}),
		}),
	})).default([]),
	measurement: Joi.alternatives().try(pingSchema, tracerouteSchema).required(),
	limit: Joi.number().min(1).max(100),
});

const handle = async (ctx: Context) => {
	const request = ctx.request.body as MeasurementRequest;

	try {
		const config = await runner.run(request);

		ctx.body = {
			id: config.id,
			probesCount: config.probes.length,
		};
	} catch (error: unknown) {
		ctx.status = 400;

		if (error instanceof Error) {
			ctx.body = error.message;
		}
	}
};

export const registerCreateMeasurementRoute = (router: Router): void => {
	router.post('/measurements', bodyParser(), validate(schema), handle);
};
