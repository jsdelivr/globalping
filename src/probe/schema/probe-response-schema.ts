import Joi from 'joi';
import validator from 'validator';
import { SocketProbe, ProbeStats, LocalAdoptionServer } from '../types.js';
import { globalIpOptions } from '../../measurement/schema/utils.js';

export const statusSchema = Joi.string<SocketProbe['status']>().valid('initializing', 'ready', 'unbuffer-missing', 'ping-test-failed', 'icmp-tcp-test-failed', 'too-many-disconnects', 'sigterm').required();

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

const logTimestampSchema = Joi.string().max(32).isoDate().strict().custom((value: string, helpers) => {
	if (!validator.isISO8601(value, { strict: true })) {
		return helpers.error('string.isoDate');
	}

	return value;
});

const logEntrySchema = Joi.object({
	message: Joi.string().max(8192).required(),
	timestamp: logTimestampSchema.required(),
	level: Joi.string().max(8).required(),
	scope: Joi.string().max(64).required(),
});

export const logMessageSchema = Joi.object({
	skipped: Joi.number().integer().min(0).strict().required(),
	logs: Joi.array().items(logEntrySchema).min(0).max(200).required(),
}).required();

export const altIpsSchema = Joi.array().max(2048).items(Joi.array<[string, string]>().ordered(Joi.string().ip(globalIpOptions).required(), Joi.string().length(32).required()));

export const localAdoptionServerSchema = Joi.object<LocalAdoptionServer>({
	expiresAt: Joi.string().isoDate().required(),
	token: Joi.string().hex().length(64).required(),
	ips: Joi.array().items(Joi.string().ip(globalIpOptions)).max(32).required(),
}).required();
