import Joi from 'joi';
import type { Probe } from '../types.js';

const schema = Joi.string<Probe['status']>().valid('initializing', 'ready', 'unbuffer-missing', 'ping-test-failed', 'sigterm').required();

export const handleStatusUpdate = (probe: Probe) => (status: Probe['status']) => {
	const validation = schema.validate(status);

	if (validation.error) {
		throw validation.error;
	}

	probe.status = validation.value;
};
