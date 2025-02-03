import Joi from 'joi';
import type { Probe } from '../types.js';

const schema = Joi.string<Probe['status']>().valid('initializing', 'ready', 'unbuffer-missing', 'ping-test-failed', 'sigterm');

export const handleStatusUpdate = (probe: Probe) => async (input: unknown) => {
	const validation = schema.validate(input);

	if (validation.error) {
		throw validation.error;
	}

	probe.status = validation.value;
};
