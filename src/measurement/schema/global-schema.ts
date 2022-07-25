import config from 'config';
import Joi from 'joi';
import type {LocationWithLimit} from '../types.js';
import {
	targetSchema,
	measurementSchema,
} from './command-schema.js';
import {schema as locationSchema} from './location-schema.js';

const measurementConfig = config.get<{limits: {global: number; location: number}}>('measurement');

// eslint-disable-next-line unicorn/explicit-length-check
const limitDefaultHandler = (parent: {locations: LocationWithLimit[]}) => parent.locations.length || 1;

export const schema = Joi.object({
	type: Joi.string().valid('ping', 'traceroute', 'dns', 'mtr', 'http').insensitive().required(),
	target: targetSchema,
	measurementOptions: measurementSchema,
	locations: locationSchema,
	limit: Joi.number().min(1).max(measurementConfig.limits.global).default(limitDefaultHandler),
});
