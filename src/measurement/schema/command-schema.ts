import Joi, {CustomHelpers, ErrorReport} from 'joi';
import isIpPrivate from 'private-ip';
import {
	joiValidate as joiMalwareValidate,
	joiSchemaErrorMessage as joiMalwareSchemaErrorMessage,
} from '../../lib/malware/client.js';
import {joiValidate as joiMalwareValidateIp} from '../../lib/malware/ip.js';
import {joiValidate as joiMalwareValidateDomain} from '../../lib/malware/domain.js';

export const validCmdTypes = ['ping', 'dns', 'traceroute'];

export const joiValidateTarget = (type: string) => (value: string, helpers: CustomHelpers): string | ErrorReport => {
	if (['ip', 'any'].includes(type) && isIpPrivate(value)) {
		return helpers.error('ip.private');
	}

	if (type === 'domain') {
		return joiMalwareValidateDomain(value, helpers);
	}

	if (type === 'ip') {
		return joiMalwareValidateIp(value, helpers);
	}

	return joiMalwareValidate(value, helpers);
};

export const schemaErrorMessages = {
	...joiMalwareSchemaErrorMessage(),
	'ip.private': 'Private hostnames are not allowed.',
};

export const pingSchema = Joi.object({
	type: Joi.string().valid('ping').insensitive().required(),
	target: Joi.alternatives().try(Joi.string().ip(), Joi.string().domain()).custom(joiValidateTarget('any')).required(),
	packets: Joi.number().min(1).max(16).default(3),
}).messages(schemaErrorMessages);

export const tracerouteSchema = Joi.object({
	type: Joi.string().valid('traceroute').insensitive().required(),
	target: Joi.alternatives().try(Joi.string().ip(), Joi.string().domain()).custom(joiValidateTarget('any')).required(),
	protocol: Joi.string().valid('TCP', 'UDP', 'ICMP').insensitive().default('ICMP'),
	port: Joi.number().port().default(80),
}).messages(schemaErrorMessages);

const allowedTypes = ['A', 'AAAA', 'ANY', 'CNAME', 'DNSKEY', 'DS', 'MX', 'NS', 'NSEC', 'PTR', 'RRSIG', 'SOA', 'TXT', 'SRV'];
const allowedProtocols = ['UDP', 'TCP'];

export const dnsSchema = Joi.object({
	type: Joi.string().valid('dns').insensitive().required(),
	target: Joi.string().domain().custom(joiValidateTarget('domain')).required(),
	query: Joi.object({
		type: Joi.string().valid(...allowedTypes).insensitive().default('A'),
		resolver: Joi.string().ip().custom(joiMalwareValidateIp),
		protocol: Joi.string().valid(...allowedProtocols).insensitive().default('UDP'),
		port: Joi.number().default('53'),
	}).default({}),
}).messages(schemaErrorMessages);
