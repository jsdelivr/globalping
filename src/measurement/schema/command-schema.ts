import Joi from 'joi';
import type {CustomHelpers, Extension} from 'joi';
import validator from 'validator';

const targetJoi: Extension = {
	type: 'target',
	base: Joi.string(),
	validate(value: string, helpers: CustomHelpers) {
		if (helpers.schema.$_getFlag('any')) {
			// Check ipv4 and domain
			if (!validator.isIP(value, 4) && !validator.isFQDN(value)) {
				return {errors: helpers.error('target.any')};
			}
		} else if (helpers.schema.$_getFlag('ipv4')) {
			// Check ipv4
			if (!validator.isIP(value, 4)) {
				return {errors: helpers.error('target.ipv4')};
			}
		} else if (helpers.schema.$_getFlag('host') // Check host
      && !validator.isFQDN(value)) {
			return {errors: helpers.error('target.host')};
		}

		return {
			value,
		};
	},
	/* eslint-disable @typescript-eslint/no-confusing-void-expression */
	// Joi extension.rules.method typing returns `void` but schema needs `this` value
	rules: {
		any: {
			method(): void {
				return this.$_setFlag('any', true);
			},
		},
		ipv4: {
			method(): void {
				return this.$_setFlag('ipv4', true);
			},
		},
		host: {
			method(): void {
				return this.$_setFlag('host', true);
			},
		},
	},
	/* eslint-enable @typescript-eslint/no-confusing-void-expression */

};

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
// Joi extension returns `any` type. ¯\(o_o)/¯
export const pingSchema = Joi.object({
	type: Joi.string().valid('ping').insensitive().required(),
	target: Joi.extend(targetJoi).target().any().required(),
	packets: Joi.number().min(1).max(16).default(3),
});

export const tracerouteSchema = Joi.object({
	type: Joi.string().valid('traceroute').insensitive().required(),
	target: Joi.extend(targetJoi).target().any().required(),
	protocol: Joi.string().valid('TCP', 'UDP', 'ICMP').insensitive().default('UDP'),
	port: Joi.number().port().default(80),
});

const allowedTypes = ['A', 'AAAA', 'ANY', 'CNAME', 'DNSKEY', 'DS', 'MX', 'NS', 'NSEC', 'PTR', 'RRSIG', 'SOA', 'TXT', 'SRV'];
const allowedProtocols = ['UDP', 'TCP'];

export const dnsSchema = Joi.object({
	type: Joi.string().valid('dns').insensitive().required(),
	target: Joi.extend(targetJoi).target().host().required(),
	query: Joi.object({
		type: Joi.string().valid(...allowedTypes).insensitive().default('A'),
		resolver: Joi.string(),
		protocol: Joi.string().valid(...allowedProtocols).insensitive().default('UDP'),
		port: Joi.number().default('53'),
	}).default({}),
});
/* eslint-enable @typescript-eslint/no-unsafe-call */
/* eslint-enable @typescript-eslint/no-unsafe-assignment */
