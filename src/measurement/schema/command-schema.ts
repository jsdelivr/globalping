import Joi from 'joi';
import {joiValidate} from '../../lib/malware/client.js';
import {joiValidate as joiValidateIp} from '../../lib/malware/ip.js';
import {joiValidate as joiValidateDomain} from '../../lib/malware/domain.js';

export const pingSchema = Joi.object({
	type: Joi.string().valid('ping').insensitive().required(),
	target: Joi.alternatives().try(Joi.string().ip(), Joi.string().domain()).custom(joiValidate).required(),
	packets: Joi.number().min(1).max(16).default(3),
});

export const tracerouteSchema = Joi.object({
	type: Joi.string().valid('traceroute').insensitive().required(),
	target: Joi.alternatives().try(Joi.string().ip(), Joi.string().domain()).custom(joiValidate).required(),
	protocol: Joi.string().valid('TCP', 'UDP', 'ICMP').insensitive().default('ICMP'),
	port: Joi.number().port().default(80),
});

const allowedTypes = ['A', 'AAAA', 'ANY', 'CNAME', 'DNSKEY', 'DS', 'MX', 'NS', 'NSEC', 'PTR', 'RRSIG', 'SOA', 'TXT', 'SRV'];
const allowedProtocols = ['UDP', 'TCP'];

export const dnsSchema = Joi.object({
	type: Joi.string().valid('dns').insensitive().required(),
	target: Joi.string().domain().custom(joiValidateDomain).required(),
	query: Joi.object({
		type: Joi.string().valid(...allowedTypes).insensitive().default('A'),
		resolver: Joi.string().ip().custom(joiValidateIp),
		protocol: Joi.string().valid(...allowedProtocols).insensitive().default('UDP'),
		port: Joi.number().default('53'),
	}).default({}),
});
