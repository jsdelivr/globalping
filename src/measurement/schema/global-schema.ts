import config from 'config';
import Joi from 'joi';
import {
	targetSchema,
	measurementSchema,
} from './command-schema.js';
import { schema as locationSchema } from './location-schema.js';
import { GLOBAL_DEFAULTS } from './utils.js';

const authenticatedTestsPerMeasurement = config.get<number>('measurement.limits.authenticatedTestsPerMeasurement');
const anonymousTestsPerMeasurement = config.get<number>('measurement.limits.anonymousTestsPerMeasurement');

export const schema = Joi.object({
	type: Joi.string().valid('ping', 'traceroute', 'dns', 'mtr', 'http').insensitive().required(),
	target: targetSchema,
	measurementOptions: measurementSchema,
	locations: locationSchema,
	limit: Joi.number().min(1).when('$userId', {
		is: Joi.exist(),
		then: Joi.number().max(authenticatedTestsPerMeasurement),
		otherwise: Joi.number().max(anonymousTestsPerMeasurement),
	}).default(GLOBAL_DEFAULTS.limit),
	inProgressUpdates: Joi.bool().default(GLOBAL_DEFAULTS.inProgressUpdates),
});
