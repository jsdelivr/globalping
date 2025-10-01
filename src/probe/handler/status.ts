import { statusSchema } from '../schema/probe-response-schema.js';
import type { SocketProbe } from '../types.js';

export const handleStatusUpdate = (probe: SocketProbe) => (status: SocketProbe['status']) => {
	const validation = statusSchema.validate(status);

	if (validation.error) {
		throw validation.error;
	}

	probe.status = validation.value;
};
