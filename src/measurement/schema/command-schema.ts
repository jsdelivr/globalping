import Joi from 'joi';

export const pingSchema = Joi.object({
	type: Joi.string().valid('ping').required(),
	target: Joi.string().required(),
	packets: Joi.number().min(1).max(16).default(3),
});

export const tracerouteSchema = Joi.object({
	type: Joi.string().valid('traceroute').required(),
	target: Joi.string().required(),
	protocol: Joi.string().valid('TCP', 'UDP', 'ICMP').default('UDP'),
	port: Joi.number().port().default(80),
});

const allowedTypes = ['A', 'AAAA', 'ANY', 'CNAME', 'DNSKEY', 'DS', 'MX', 'NS', 'NSEC', 'PTR', 'RRSIG', 'SOA', 'TXT', 'SRV'];
const allowedProtocols = ['UDP', 'TCP'];

export const dnsSchema = Joi.object({
	type: Joi.string().valid('dns').required(),
	target: Joi.string().required(),
	query: Joi.object({
		type: Joi.string().valid(...allowedTypes).default('A'),
		resolver: Joi.string(),
		protocol: Joi.string().valid(...allowedProtocols).default('UDP'),
		port: Joi.number().default('53'),
	}).default({}),
});
