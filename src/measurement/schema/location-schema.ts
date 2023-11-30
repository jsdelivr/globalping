
import anyAscii from 'any-ascii';
import Joi from 'joi';
import config from 'config';

import { continents, countries } from 'countries-list';
import { states } from '../../lib/location/states.js';
import { regionNames } from '../../lib/location/regions.js';
import { GLOBAL_DEFAULTS } from './utils.js';

const measurementConfig = config.get<{limits: {global: number; location: number}}>('measurement');

const normalizeValue = (value: string): string => anyAscii(value);

export const schema = Joi.alternatives().try(
	Joi.string(),
	Joi.array().items(Joi.object().keys({
		continent: Joi.string().valid(...Object.keys(continents)).insensitive()
			.messages({ 'any.only': 'The continent must be a valid two-letter continent code' }),
		region: Joi.string().valid(...regionNames).insensitive(),
		country: Joi.string().valid(...Object.keys(countries)).insensitive()
			.messages({ 'any.only': 'The country must be a valid two-letter ISO code' }),
		state: Joi.string().valid(...Object.values(states)).insensitive()
			.messages({ 'any.only': 'The US state must be a valid two-letter code, e.g. CA' }),
		city: Joi.string().min(1).max(128).lowercase().custom(normalizeValue),
		network: Joi.string().min(1).max(128).lowercase().custom(normalizeValue),
		asn: Joi.number().integer().positive(),
		magic: Joi.string().min(1).lowercase().custom(normalizeValue),
		tags: Joi.array().items(Joi.string().min(1).max(128).lowercase().custom(normalizeValue)),
		limit: Joi.number().min(1).max(measurementConfig.limits.location).when(Joi.ref('/limit'), {
			is: Joi.exist(),
			then: Joi.forbidden().messages({ 'any.unknown': 'limit per location is not allowed when a global limit is set' }),
			otherwise: Joi.number().default(1),
		}),
	}).or('continent', 'region', 'country', 'state', 'city', 'network', 'asn', 'magic', 'tags')),
).default(GLOBAL_DEFAULTS.locations);
