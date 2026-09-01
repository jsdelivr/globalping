import config from 'config';
import Joi from 'joi';
import {
	targetSchema,
	measurementSchema,
} from './command-schema.js';
import { schema as locationSchema } from './location-schema.js';
import { GLOBAL_DEFAULTS, getMeasurementTimeout } from './utils.js';
import type { MeasurementRequest } from '../types.js';

const authenticatedTestsPerMeasurement = config.get<number>('measurement.limits.authenticatedTestsPerMeasurement');
const anonymousTestsPerMeasurement = config.get<number>('measurement.limits.anonymousTestsPerMeasurement');

export const schema = Joi.object({
	type: Joi.string().valid('ping', 'traceroute', 'dns', 'mtr', 'http').insensitive().required(),
	target: targetSchema,
	measurementOptions: measurementSchema,
	timeout: Joi.number().integer().min(5).max(30).default((request: MeasurementRequest) => getMeasurementTimeout(request.type, request.measurementOptions)),
	locations: locationSchema,
	limit: Joi.number().integer().min(1).when('$user.id', {
		is: Joi.string().required(),
		then: Joi.number().max(authenticatedTestsPerMeasurement),
		otherwise: Joi.number().max(anonymousTestsPerMeasurement),
	}).default(GLOBAL_DEFAULTS.limit),
	inProgressUpdates: Joi.bool().default(GLOBAL_DEFAULTS.inProgressUpdates),
});
