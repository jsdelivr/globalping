import config from 'config';
import Joi from 'joi';
import {dnsSchema, pingSchema, tracerouteSchema, mtrSchema, httpSchema} from './command-schema.js';
import {schema as locationSchema} from './location-schema.js';

const measurementConfig = config.get<{limits: {global: number; location: number}}>('measurement');

export const schema = Joi.object({
	locations: locationSchema,
	measurement: Joi.alternatives().try(pingSchema, tracerouteSchema, dnsSchema, mtrSchema, httpSchema).required(),
	limit: Joi.number().min(1).max(measurementConfig.limits.global).default(1),
});
