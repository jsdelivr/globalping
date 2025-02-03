import Joi from 'joi';
import type { Probe } from '../types.js';

const schema = Joi.array<string[]>().items(Joi.string()).required();

export const handleDnsUpdate = (probe: Probe) => (list: string[]): void => {
	const validation = schema.validate(list);

	if (validation.error) {
		throw validation.error;
	}

	probe.resolvers = validation.value;
};
