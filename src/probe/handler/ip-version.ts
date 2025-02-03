import Joi from 'joi';
import type { Probe } from '../types.js';

const schema = Joi.boolean().required();

export const handleIsIPv4SupportedUpdate = (probe: Probe) => (isIPv4Supported: boolean): void => {
	const validation = schema.validate(isIPv4Supported);

	if (validation.error) {
		throw validation.error;
	}

	probe.isIPv4Supported = validation.value;
};

export const handleIsIPv6SupportedUpdate = (probe: Probe) => (isIPv6Supported: boolean): void => {
	const validation = schema.validate(isIPv6Supported);

	if (validation.error) {
		throw validation.error;
	}

	probe.isIPv6Supported = validation.value;
};
