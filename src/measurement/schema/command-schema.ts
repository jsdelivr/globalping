import Joi from 'joi';
import {
	joiSchemaErrorMessages as joiMalwareSchemaErrorMessages,
} from '../../lib/malware/client.js';
import {
	joiValidateDomain,
	joiValidateDomainForDns,
	joiValidateTarget,
	whenTypeApply,
	globalIpOptions,
	COMMAND_DEFAULTS,
	DEFAULT_IP_VERSION,
} from './utils.js';

export const schemaErrorMessages = {
	...joiMalwareSchemaErrorMessages,
	'ip.private': '{{#label}} must not be a private hostname',
	'domain.invalid': '{{#label}} must be a valid domain name',
};


const allowedIpVersions = [ 4, 6 ];

export const ipVersionSchema = Joi.number().when(Joi.ref('...target'), {
	is: Joi.custom(joiValidateDomain()),
	then: Joi.valid(...allowedIpVersions).optional().default(DEFAULT_IP_VERSION),
	otherwise: Joi.when(Joi.ref('...target'), {
		is: Joi.string().ip({ version: [ 'ipv6' ], cidr: 'forbidden' }),
		then: Joi.forbidden().default(6),
		otherwise: Joi.forbidden().default(DEFAULT_IP_VERSION),
	}),
}).messages({
	'any.only': '{{#label}} must be either 4 or 6',
	'any.unknown': '{{#label}} is not allowed when target is not a domain',
});
export const ipVersionDnsSchema = Joi.number().when(Joi.ref('resolver'), {
	is: Joi.custom(joiValidateDomain()),
	then: Joi.valid(...allowedIpVersions).optional().default(DEFAULT_IP_VERSION),
	otherwise: Joi.when(Joi.ref('resolver'), {
		is: Joi.string().ip({ version: [ 'ipv6' ], cidr: 'forbidden' }),
		then: Joi.forbidden().default(6),
		otherwise: Joi.forbidden().default(DEFAULT_IP_VERSION),
	}),
}).messages({
	'any.only': '{{#label}} must be either 4 or 6',
	'any.unknown': '{{#label}} is not allowed when resolver is not a domain',
});

export const validCmdTypes = [ 'ping', 'dns', 'traceroute', 'mtr', 'http' ];

const allowedHttpProtocols = [ 'HTTP', 'HTTPS', 'HTTP2' ];
const allowedHttpMethods = [ 'GET', 'HEAD', 'OPTIONS' ];

// Http
const httpTargetSchema = Joi.alternatives()
	.try(Joi.string().ip(globalIpOptions), Joi.custom(joiValidateDomain()))
	.custom(joiValidateTarget('any'))
	.required()
	.messages(schemaErrorMessages);

export const httpSchema = Joi.object({
	request: Joi.object({
		method: Joi.string().valid(...allowedHttpMethods).insensitive().default(COMMAND_DEFAULTS.http.request.method),
		host: Joi.string().domain().custom(joiValidateTarget('domain')).optional(),
		path: Joi.string().max(16384).optional().default(COMMAND_DEFAULTS.http.request.path),
		query: Joi.string().max(16384).optional().default(COMMAND_DEFAULTS.http.request.query),
		headers: Joi.object().max(128).pattern(/^/, Joi.string().max(8192)).default(COMMAND_DEFAULTS.http.request.headers),
	}).default(),
	resolver: Joi.string().ip(globalIpOptions).custom(joiValidateTarget('ip')),
	protocol: Joi.string().valid(...allowedHttpProtocols).insensitive().default(COMMAND_DEFAULTS.http.protocol),
	port: Joi.number().port(),
	ipVersion: ipVersionSchema,
}).default().messages(schemaErrorMessages);

// Mtr
const mtrTargetSchema = Joi.alternatives()
	.try(Joi.string().ip(globalIpOptions), Joi.custom(joiValidateDomain()))
	.custom(joiValidateTarget('any'))
	.required()
	.messages(schemaErrorMessages);

const allowedMtrProtocols = [ 'UDP', 'TCP', 'ICMP' ];

export const mtrSchema = Joi.object({
	protocol: Joi.string().valid(...allowedMtrProtocols).insensitive().default(COMMAND_DEFAULTS.mtr.protocol),
	packets: Joi.number().min(1).max(16).default(COMMAND_DEFAULTS.mtr.packets),
	port: Joi.number().port().default(COMMAND_DEFAULTS.mtr.port),
	ipVersion: ipVersionSchema,
}).default().messages(schemaErrorMessages);

// Ping
const pingTargetSchema = Joi.alternatives()
	.try(Joi.string().ip(globalIpOptions), Joi.custom(joiValidateDomain()))
	.custom(joiValidateTarget('any'))
	.required()
	.messages(schemaErrorMessages);

export const pingSchema = Joi.object({
	packets: Joi.number().min(1).max(16).default(COMMAND_DEFAULTS.ping.packets),
	protocol: Joi.string().valid('TCP', 'ICMP').insensitive().default(COMMAND_DEFAULTS.ping.protocol),
	port: Joi.number().port().default(COMMAND_DEFAULTS.ping.port),
	ipVersion: ipVersionSchema,
}).default().messages(schemaErrorMessages);

// Traceroute
const tracerouteTargetSchema = Joi.alternatives()
	.try(Joi.string().ip(globalIpOptions), Joi.custom(joiValidateDomain()))
	.custom(joiValidateTarget('any'))
	.required()
	.messages(schemaErrorMessages);

export const tracerouteSchema = Joi.object({
	protocol: Joi.string().valid('TCP', 'UDP', 'ICMP').insensitive().default(COMMAND_DEFAULTS.traceroute.protocol),
	port: Joi.number().port().default(COMMAND_DEFAULTS.traceroute.port),
	ipVersion: ipVersionSchema,
}).default().messages(schemaErrorMessages);

const allowedDnsTypes = [ 'A', 'AAAA', 'ANY', 'CNAME', 'DNSKEY', 'DS', 'HTTPS', 'MX', 'NS', 'NSEC', 'PTR', 'RRSIG', 'SOA', 'TXT', 'SRV', 'SVCB' ];
const allowedDnsProtocols = [ 'UDP', 'TCP' ];

// Dns
const dnsDefaultTargetSchema = Joi.custom(joiValidateDomainForDns()).custom(joiValidateTarget('domain')).required().messages(schemaErrorMessages);
const dnsPtrTargetSchema = Joi.string().ip(globalIpOptions).custom(joiValidateTarget('ip')).required().messages(schemaErrorMessages);
const dnsTargetSchema = Joi.when(Joi.ref('..measurementOptions.query.type'), { is: Joi.string().insensitive().valid('PTR').required(), then: dnsPtrTargetSchema, otherwise: dnsDefaultTargetSchema });

export const dnsSchema = Joi.object({
	query: Joi.object({
		type: Joi.string().valid(...allowedDnsTypes).insensitive().default(COMMAND_DEFAULTS.dns.query.type),
	}).default(),
	resolver: Joi.alternatives()
		.try(Joi.string().ip(globalIpOptions), Joi.custom(joiValidateDomain()))
		.custom(joiValidateTarget('any')),
	protocol: Joi.string().valid(...allowedDnsProtocols).insensitive().default(COMMAND_DEFAULTS.dns.protocol),
	port: Joi.number().port().default(COMMAND_DEFAULTS.dns.port),
	trace: Joi.boolean().default(COMMAND_DEFAULTS.dns.trace),
	ipVersion: ipVersionDnsSchema,
}).default().messages(schemaErrorMessages);

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
