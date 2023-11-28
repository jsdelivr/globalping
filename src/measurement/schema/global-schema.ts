import config from 'config';
import Joi from 'joi';
import {
	targetSchema,
	measurementSchema,
} from './command-schema.js';
import { schema as locationSchema } from './location-schema.js';
import { GLOBAL_DEFAULTS } from './utils.js';

const measurementConfig = config.get<{limits: {global: number; location: number}}>('measurement');

export const schema = Joi.object({
	type: Joi.string().valid('ping', 'traceroute', 'dns', 'mtr', 'http').insensitive().required(),
	target: targetSchema,
	measurementOptions: measurementSchema,
	locations: Joi.alternatives().try(locationSchema, Joi.string()),
	limit: Joi.number().min(1).max(measurementConfig.limits.global).default(GLOBAL_DEFAULTS.limit),
	inProgressUpdates: Joi.bool().default(GLOBAL_DEFAULTS.inProgressUpdates),
});
