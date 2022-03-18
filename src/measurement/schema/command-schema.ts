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
