import Joi from 'joi';

export const PingSchema = Joi.object({
	type: Joi.string().valid('ping'),
	target: Joi.string(),
	packets: Joi.number().min(1).max(16).default(3),
});

export const TracerouteSchema = Joi.object({
	type: Joi.string().valid('traceroute'),
	target: Joi.string(),
	protocol: Joi.string().valid('TCP', 'UDP', 'ICMP').default('UDP'),
	port: Joi.number().port().default(80),
});
