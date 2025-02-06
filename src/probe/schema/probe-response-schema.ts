import Joi from 'joi';
import { Probe, ProbeStats } from '../types.js';

export const statusSchema = Joi.string<Probe['status']>().valid('initializing', 'ready', 'unbuffer-missing', 'ping-test-failed', 'sigterm').required();

export const ipVersionSchema = Joi.boolean().required();

export const dnsSchema = Joi.array<string[]>().items(Joi.string()).required();

export const statsSchema = Joi.object<ProbeStats>({
	cpu: Joi.object({
		load: Joi.array().items(Joi.object({
			usage: Joi.number().required(),
		})).required(),
	}).required(),
	jobs: Joi.object({
		count: Joi.number().required(),
	}).required(),
}).required();
