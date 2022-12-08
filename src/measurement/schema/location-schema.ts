/* eslint-disable @typescript-eslint/naming-convention */

import anyAscii from 'any-ascii';
import Joi from 'joi';
import config from 'config';

import geoLists from 'countries-list';
import {states} from '../../lib/location/states.js';
import {regionNames} from '../../lib/location/regions.js';

const {continents, countries} = geoLists;
const measurementConfig = config.get<{limits: {global: number; location: number}}>('measurement');

const normalizeValue = (value: string): string => anyAscii(value);

export const schema = Joi.array().items(Joi.object().keys({
	continent: Joi.string().valid(...Object.keys(continents)).custom(normalizeValue).insensitive()
		.messages({'any.only': 'The continent must be a valid two-letter continent code'}),
	region: Joi.string().valid(...regionNames).custom(normalizeValue).insensitive(),
	country: Joi.string().valid(...Object.keys(countries)).custom(normalizeValue).insensitive()
		.messages({'any.only': 'The country must be a valid two-letter ISO code'}),
	state: Joi.string().valid(...Object.keys(states)).custom(normalizeValue).insensitive()
		.messages({'any.only': 'The US state must be a valid two-letter code, e.g. CA'}),
	city: Joi.string().min(1).max(128).lowercase().custom(normalizeValue).insensitive(),
	network: Joi.string().min(1).max(128).lowercase().custom(normalizeValue).insensitive(),
	asn: Joi.number().integer().positive(),
	magic: Joi.string().min(1).lowercase().custom(normalizeValue).insensitive(),
	tags: Joi.array().items(Joi.string().min(1).lowercase().custom(normalizeValue).insensitive()),
	limit: Joi.number().min(1).max(measurementConfig.limits.location).when(Joi.ref('/limit'), {
		is: Joi.exist(),
		then: Joi.forbidden().messages({'any.unknown': 'limit per location is not allowed when a global limit is set'}),
	}),
}).or('continent', 'region', 'country', 'state', 'city', 'network', 'asn', 'magic', 'tags')).default([]);
