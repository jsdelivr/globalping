import Joi from 'joi';
import { Probe, ProbeStats } from '../types.js';

export const statusSchema = Joi.string<Probe['status']>().valid('initializing', 'ready', 'unbuffer-missing', 'ping-test-failed', 'sigterm').required();

export const ipVersionSchema = Joi.boolean().required();

export const dnsSchema = Joi.array<string[]>().max(1024).items(Joi.string().max(1024)).required();

export const adoptionTokenSchema = Joi.string().max(1024).required();

export const statsSchema = Joi.object<ProbeStats>({
	cpu: Joi.object({
		load: Joi.array().max(1024).items(Joi.object({
			usage: Joi.number().required(),
		})).required(),
	}).required(),
	jobs: Joi.object({
		count: Joi.number().required(),
	}).required(),
}).required();
