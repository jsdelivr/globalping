import Joi from 'joi';
import config from 'config';

import geoLists from 'countries-list';
import {states} from '../../lib/location/states.js';
import {regions} from '../../lib/location/regions.js';

const {continents, countries} = geoLists;
const measurementConfig = config.get<{limits: {global: number; location: number}}>('measurement');

export const schema = Joi.array().items(Joi.object({
	type: Joi.string().valid('continent', 'region', 'country', 'state', 'city', 'network', 'asn', 'magic').insensitive().required(),
	value: Joi.alternatives().conditional('type', {
		switch: [
			{
				is: 'continent',
				then: Joi.string().valid(...Object.keys(continents)).insensitive()
					.messages({'any.only': 'The continent must be a valid two-letter ISO code'}),
			},
			{is: 'region', then: Joi.string().valid(...Object.keys(regions)).insensitive()},
			{
				is: 'country',
				then: Joi.string().valid(...Object.keys(countries)).insensitive()
					.messages({'any.only': 'The country must be a valid two-letter ISO code'}),
			},
			{
				is: 'state',
				then: Joi.string().valid(...Object.keys(states)).insensitive()
					.messages({'any.only': 'The US state must be a valid two-letter code, e.g. CA'}),
			},
			{is: 'city', then: Joi.string().min(1).max(128).lowercase().insensitive()},
			{is: 'network', then: Joi.string().min(1).max(128).lowercase().insensitive()},
			{is: 'asn', then: Joi.number()},
			{is: 'magic', then: Joi.string().min(1).insensitive()},
		],
	}).required().messages({
		'any.required': 'Location value is required',
	}),
	limit: Joi.number().min(1).max(measurementConfig.limits.location).when(Joi.ref('/limit'), {
		is: Joi.exist(),
		then: Joi.forbidden().messages({'any.unknown': 'limit per location is not allowed when a global limit is set'}),
		otherwise: Joi.required().messages({'any.required': 'limit per location required when no global limit is set'}),
	}),
})).default([]);
