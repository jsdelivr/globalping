import Joi from 'joi';
import config from 'config';
import type {Context} from 'koa';
import type Router from '@koa/router';
import bodyParser from 'koa-bodyparser';
import geoLists from 'countries-list';
import {getMeasurementRunner} from '../runner.js';
import type {MeasurementRequest} from '../types.js';
import {states} from '../../lib/location/states.js';
import {regions} from '../../lib/location/regions.js';
import {validate} from '../../lib/http/middleware/validate.js';
import {dnsSchema, pingSchema, tracerouteSchema} from '../schema/command-schema.js';

const runner = getMeasurementRunner();
const {continents, countries} = geoLists;
const measurementConfig = config.get<{limits: {global: number; location: number}}>('measurement');

// Todo: better validation. hostname/ip validation for targets
const schema = Joi.object({
	locations: Joi.array().items(Joi.object({
		type: Joi.string().valid('continent', 'region', 'country', 'state', 'city', 'asn').required(),
		value: Joi.alternatives().conditional('type', {
			switch: [
				{
					is: 'continent',
					then: Joi.string().valid(...Object.keys(continents))
						.messages({'any.only': 'The continent must be a valid two-letter ISO code'}),
				},
				{is: 'region', then: Joi.string().valid(...Object.keys(regions))},
				{
					is: 'country',
					then: Joi.string().valid(...Object.keys(countries))
						.messages({'any.only': 'The country must be a valid two-letter ISO code'}),
				},
				{
					is: 'state',
					then: Joi.string().valid(...Object.keys(states))
						.messages({'any.only': 'The US state must be a valid two-letter code, e.g. CA'}),
				},
				{is: 'city', then: Joi.string().min(1).max(128)},
				{is: 'asn', then: Joi.number()},
			],
		}).required().messages({
			'any.required': 'Location value is required',
		}),
		limit: Joi.number().min(1).max(measurementConfig.limits.location).when(Joi.ref('/limit'), {
			is: Joi.exist(),
			then: Joi.forbidden().messages({'any.unknown': 'limit per location is not allowed when a global limit is set'}),
			otherwise: Joi.required().messages({'any.required': 'limit per location required when no global limit is set'}),
		}),
	})).default([]),
	measurement: Joi.alternatives().try(pingSchema, tracerouteSchema, dnsSchema).required(),
	limit: Joi.number().min(1).max(measurementConfig.limits.global),
});

const handle = async (ctx: Context) => {
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
