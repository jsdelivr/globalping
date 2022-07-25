import Joi from 'joi';
import {joiValidate as joiMalwareValidateIp} from '../../lib/malware/ip.js';
import {
	joiSchemaErrorMessage as joiMalwareSchemaErrorMessage,
} from '../../lib/malware/client.js';
import {
	joiValidateTarget,
	whenTypeApply,
	globalIpOptions,
} from './utils.js';

/* eslint-disable @typescript-eslint/naming-convention */
export const schemaErrorMessages = {
	...joiMalwareSchemaErrorMessage(),
	'ip.private': 'Private hostnames are not allowed.',
};
/* eslint-enable @typescript-eslint/naming-convention */

export const validCmdTypes = ['ping', 'dns', 'traceroute', 'mtr', 'http'];

const allowedHttpProtocols = ['http', 'https', 'http2'];
const allowedHttpMethods = ['get', 'head'];

const httpTargetSchema = Joi.alternatives().try(Joi.string().ip(globalIpOptions), Joi.string().domain()).custom(joiValidateTarget('any')).required();
export const httpSchema = Joi.object({
	request: Joi.object({
		method: Joi.string().valid(...allowedHttpMethods).insensitive().default('head'),
		host: Joi.string().domain().custom(joiValidateTarget('domain')).optional(),
		path: Joi.string().optional().default('/'),
		query: Joi.string().optional().default(''),
		headers: Joi.object().default({}),
	}).default({}),
	resolver: Joi.string().ip(globalIpOptions).custom(joiMalwareValidateIp).custom(joiValidateTarget('ip')),
	protocol: Joi.string().valid(...allowedHttpProtocols).insensitive().default('https'),
	port: Joi.number(),
});

const mtrTargetSchema = Joi.alternatives().try(Joi.string().ip(globalIpOptions), Joi.string().domain()).custom(joiValidateTarget('any')).required();
const allowedMtrProtocols = ['UDP', 'TCP', 'ICMP'];
export const mtrSchema = Joi.object({
	protocol: Joi.string().valid(...allowedMtrProtocols).insensitive().default('ICMP'),
	packets: Joi.number().min(1).max(16).default(3),
	port: Joi.number().port().default(80),
});

const pingTargetSchema = Joi.alternatives().try(Joi.string().ip(globalIpOptions), Joi.string().domain()).custom(joiValidateTarget('any')).required();
export const pingSchema = Joi.object({
	packets: Joi.number().min(1).max(16).default(3),
}).messages(schemaErrorMessages);

const tracerouteTargetSchema = Joi.alternatives().try(Joi.string().ip(globalIpOptions), Joi.string().domain()).custom(joiValidateTarget('any')).required();
export const tracerouteSchema = Joi.object({
	protocol: Joi.string().valid('TCP', 'UDP', 'ICMP').insensitive().default('ICMP'),
	port: Joi.number().port().default(80),
}).messages(schemaErrorMessages);

const allowedDnsTypes = ['A', 'AAAA', 'ANY', 'CNAME', 'DNSKEY', 'DS', 'MX', 'NS', 'NSEC', 'PTR', 'RRSIG', 'SOA', 'TXT', 'SRV'];
const allowedDnsProtocols = ['UDP', 'TCP'];

const dnsTargetSchema = Joi.string().domain().custom(joiValidateTarget('domain')).required();
export const dnsSchema = Joi.object({
	request: Joi.object({
		type: Joi.string().valid(...allowedDnsTypes).insensitive().default('A'),
	}).default({}),
	resolver: Joi.string().ip(globalIpOptions).custom(joiMalwareValidateIp),
	protocol: Joi.string().valid(...allowedDnsProtocols).insensitive().default('UDP'),
	port: Joi.number().default('53'),
	trace: Joi.boolean().default(false),
}).messages(schemaErrorMessages);

/* eslint-disable unicorn/prefer-spread */
export const targetSchema = whenTypeApply('ping', pingTargetSchema)
	.concat(whenTypeApply('http', httpTargetSchema))
	.concat(whenTypeApply('traceroute', tracerouteTargetSchema))
	.concat(whenTypeApply('dns', dnsTargetSchema))
	.concat(whenTypeApply('mtr', mtrTargetSchema));

export const measurementSchema = whenTypeApply('ping', pingSchema)
	.concat(whenTypeApply('http', httpSchema))
	.concat(whenTypeApply('traceroute', tracerouteSchema))
	.concat(whenTypeApply('dns', dnsSchema))
	.concat(whenTypeApply('mtr', mtrSchema));
/* eslint-enable unicorn/prefer-spread */
