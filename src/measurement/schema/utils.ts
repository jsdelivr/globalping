import Joi, {
	type AnySchema,
	type CustomHelpers,
	type ErrorReport,
	type PresenceMode,
} from 'joi';
import validator from 'validator';
import isIpPrivate from 'private-ip';
import {
	joiValidate as joiMalwareValidate,
} from '../../lib/malware/client.js';
import { joiValidate as joiMalwareValidateIp } from '../../lib/malware/ip.js';
import { joiValidate as joiMalwareValidateDomain } from '../../lib/malware/domain.js';

export const joiValidateDomain = () => (value: string, helpers: CustomHelpers): string | ErrorReport => {
	const options = {
		allow_underscores: true,
	};

	if (!validator.isFQDN(value, options)) {
		return helpers.error('domain.invalid');
	}

	return value;
};

export const joiValidateTarget = (type: string) => (value: string, helpers?: CustomHelpers): string | ErrorReport | Error => {
	if ([ 'ip', 'any' ].includes(type) && isIpPrivate(value)) {
		if (helpers) {
			return helpers.error('ip.private');
		}

		throw new Error('ip.private');
	}

	if (type === 'domain') {
		return joiMalwareValidateDomain(value, helpers);
	}

	if (type === 'ip') {
		return joiMalwareValidateIp(value, helpers);
	}

	return joiMalwareValidate(value, helpers);
};

export const whenTypeApply = (mType: string, schema: AnySchema) => Joi.any().when(Joi.ref('/type'), { is: mType, then: schema });

export const globalIpOptions: {version: string[]; cidr: PresenceMode} = { version: [ 'ipv4' ], cidr: 'forbidden' };
