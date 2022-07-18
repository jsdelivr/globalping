/* eslint-disable @typescript-eslint/naming-convention */

import Joi from 'joi';
import config from 'config';

import geoLists from 'countries-list';
import {states} from '../../lib/location/states.js';
import {regions} from '../../lib/location/regions.js';

const {continents, countries} = geoLists;
const measurementConfig = config.get<{limits: {global: number; location: number}}>('measurement');

export const schema = Joi.array().items(Joi.object().keys({
	continent: Joi.string().valid(...Object.keys(continents)).insensitive()
		.messages({'any.only': 'The continent must be a valid two-letter ISO code'}),
	region: Joi.string().valid(...Object.keys(regions)).insensitive(),
	country: Joi.string().valid(...Object.keys(countries)).insensitive()
		.messages({'any.only': 'The country must be a valid two-letter ISO code'}),
	state: Joi.string().valid(...Object.keys(states)).insensitive()
		.messages({'any.only': 'The US state must be a valid two-letter code, e.g. CA'}),
	city: Joi.string().min(1).max(128).lowercase().insensitive(),
	network: Joi.string().min(1).max(128).lowercase().insensitive(),
	asn: Joi.number().integer().positive(),
	magic: Joi.string().min(1).insensitive(),
	limit: Joi.number().min(1).max(measurementConfig.limits.location).when(Joi.ref('/limit'), {
		is: Joi.exist(),
		then: Joi.forbidden().messages({'any.unknown': 'limit per location is not allowed when a global limit is set'}),
		otherwise: Joi.required().messages({'any.required': 'limit per location required when no global limit is set'}),
	}),
}).or('continent', 'region', 'country', 'state', 'city', 'network', 'asn', 'magic')).default([]);
