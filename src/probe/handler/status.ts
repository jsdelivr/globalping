import { statusSchema } from '../schema/probe-response-schema.js';
import type { Probe } from '../types.js';

export const handleStatusUpdate = (probe: Probe) => (status: Probe['status']) => {
	const validation = statusSchema.validate(status);

	if (validation.error) {
		throw validation.error;
	}

	probe.status = validation.value;
};
