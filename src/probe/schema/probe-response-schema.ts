import Joi from 'joi';
import { SocketProbe, ProbeStats } from '../types.js';
import { globalIpOptions } from '../../measurement/schema/utils.js';

export const statusSchema = Joi.string<SocketProbe['status']>().valid('initializing', 'ready', 'unbuffer-missing', 'ping-test-failed', 'sigterm').required();

export const ipVersionSchema = Joi.boolean().required();

export const dnsSchema = Joi.array<string[]>().max(1024).items(Joi.string().max(1024)).required();

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

const logEntrySchema = Joi.object({
	message: Joi.string().max(8192).required(),
	timestamp: Joi.string().max(32).required(),
	level: Joi.string().max(8).required(),
	scope: Joi.string().max(64).required(),
});

export const logMessageSchema = Joi.object({
	skipped: Joi.number().integer().min(0).required(),
	logs: Joi.array().items(logEntrySchema).min(0).required(),
}).required();

export const altIpsSchema = Joi.array().max(2048).items(Joi.array<[string, string]>().ordered(Joi.string().ip(globalIpOptions).required(), Joi.string().length(32).required()));
