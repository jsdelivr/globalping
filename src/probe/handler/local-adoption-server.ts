import type { SocketProbe, LocalAdoptionServer } from '../types.js';
import { localAdoptionServerSchema } from '../schema/probe-response-schema.js';

export const handleAdoptionServerStart = (probe: SocketProbe) => (data: LocalAdoptionServer) => {
	const validation = localAdoptionServerSchema.validate(data);

	if (validation.error) {
		throw validation.error;
	}

	probe.localAdoptionServer = validation.value;
};
