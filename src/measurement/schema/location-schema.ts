
import anyAscii from 'any-ascii';
import Joi, { CustomHelpers, ErrorReport } from 'joi';
import config from 'config';

import { continents, countries } from 'countries-list';
import { states } from '../../lib/location/states.js';
import { regionNames } from '../../lib/location/regions.js';
import { GLOBAL_DEFAULTS } from './utils.js';
import type { LocationWithLimit } from '../types.js';

const authenticatedTestsPerMeasurement = config.get<number>('measurement.limits.authenticatedTestsPerMeasurement');
const anonymousTestsPerMeasurement = config.get<number>('measurement.limits.anonymousTestsPerMeasurement');
const authenticatedTestsPerLocation = config.get<number>('measurement.limits.authenticatedTestsPerLocation');
const anonymousTestsPerLocation = config.get<number>('measurement.limits.anonymousTestsPerLocation');
const maxConditionsInMagicField = 4;

const normalizeValue = (value: string): string => anyAscii(value);

const validateMagic = (value: string, helpers: CustomHelpers): string | ErrorReport => {
	if (value.split('+').length > maxConditionsInMagicField) {
		return helpers.error('magic.max.conditions');
	}

	return value;
};

export const sumOfLocationsLimits = (code: string, max: number) => (value: LocationWithLimit[], helpers: CustomHelpers): LocationWithLimit[] | ErrorReport => {
	const sum = value.reduce((sum, location) => sum + (location.limit || 1), 0);

	if (sum > max) {
		return helpers.error(code);
	}

	return value;
};

export const schema = Joi.alternatives().try(
	Joi.string().max(128),
	Joi.array().max(128).items(Joi.object().keys({
		continent: Joi.string().valid(...Object.keys(continents)).insensitive()
			.messages({ 'any.only': '{{#label}} must be a valid two-letter continent code' }),
		region: Joi.string().valid(...regionNames).insensitive(),
		country: Joi.string().valid(...Object.keys(countries)).insensitive()
			.messages({ 'any.only': '{{#label}} must be a valid two-letter ISO code' }),
		state: Joi.string().valid(...Object.values(states)).insensitive()
			.messages({ 'any.only': '{{#label}} must be a valid two-letter code, e.g. CA' }),
		city: Joi.string().min(1).max(128).custom(normalizeValue),
		network: Joi.string().min(1).max(128).custom(normalizeValue),
		asn: Joi.number().integer().positive(),
		magic: Joi.string().min(1).max(128).custom(validateMagic).custom(normalizeValue),
		tags: Joi.array().max(32).items(Joi.string().min(1).max(128).custom(normalizeValue)),
		limit: Joi.number().min(1).when('$user', {
			is: Joi.exist(),
			then: Joi.number().max(authenticatedTestsPerLocation),
			otherwise: Joi.number().max(anonymousTestsPerLocation),
		}).when(Joi.ref('/limit'), {
			is: Joi.exist(),
			then: Joi.forbidden().messages({ 'any.unknown': '{{#label}} is not allowed when a global limit is set' }),
			otherwise: Joi.number().default(1),
		}),
	}).or('continent', 'region', 'country', 'state', 'city', 'network', 'asn', 'magic', 'tags'))
		.when('$user', {
			is: Joi.exist(),
			then: Joi.custom(sumOfLocationsLimits('limits.sum.auth', authenticatedTestsPerMeasurement)),
			otherwise: Joi.custom(sumOfLocationsLimits('limits.sum.anon', anonymousTestsPerMeasurement)),
		}).messages({
			'limits.sum.auth': `the sum of limits must be less than or equal to ${authenticatedTestsPerMeasurement}`,
			'limits.sum.anon': `the sum of limits must be less than or equal to ${anonymousTestsPerMeasurement}`,
			'magic.max.conditions': `{{#label}} must contain at most ${maxConditionsInMagicField} combined filters`,
		}),
).default(GLOBAL_DEFAULTS.locations);
