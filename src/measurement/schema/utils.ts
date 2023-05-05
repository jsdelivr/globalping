import Joi, {
	type AnySchema,
	type CustomHelpers,
	type ErrorReport,
	type PresenceMode,
} from 'joi';
import validator from 'validator';
import isIpPrivate from 'private-ip';
import _ from 'lodash';
import {
	joiValidate as joiMalwareValidate,
} from '../../lib/malware/client.js';
import { joiValidate as joiMalwareValidateIp } from '../../lib/malware/ip.js';
import { joiValidate as joiMalwareValidateDomain } from '../../lib/malware/domain.js';
import type { MeasurementRecord, MeasurementRequest } from '../types.js';

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

export const GLOBAL_DEFAULTS = {
	locations: [],
	limit: (request: MeasurementRequest) => request.locations.length || 1,
	inProgressUpdates: false,
};

export const COMMAND_DEFAULTS = {
	http: {
		request: {
			method: 'HEAD',
			path: '/',
			query: '',
			headers: {},
		},
		protocol: 'HTTPS',
	},
	mtr: {
		protocol: 'ICMP',
		packets: 3,
		port: 80,
	},
	ping: {
		packets: 3,
	},
	traceroute: {
		protocol: 'ICMP',
		port: 80,
	},
	dns: {
		query: {
			type: 'A',
		},
		protocol: 'UDP',
		port: 53,
		trace: false,
	},
} as const;

// Some joi defaults are not values but functions, they need to be executed to get actual value
const processFunctionDefaults = (obj: object, request: MeasurementRequest): unknown => _.mapValues(obj, (value: unknown) => {
	if (_.isFunction(value)) {
		return value(request) as unknown;
	} else if (_.isPlainObject(value)) {
		return processFunctionDefaults(value as object, request);
	}

	return value;
});

export const getDefaults = (request: MeasurementRequest) => {
	const defaultRules = {
		...GLOBAL_DEFAULTS,
		measurementOptions: COMMAND_DEFAULTS[request.type],
	};

	const defaults = processFunctionDefaults(defaultRules, request) as Partial<MeasurementRecord>;
	return defaults;
};
