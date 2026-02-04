import type { SocketProbe } from '../types.js';
import type { LocalAdoptionServer } from '../types.js';
import { localAdoptionServerSchema } from '../schema/probe-response-schema.js';

export const handleAdoptionServerStart = (probe: SocketProbe) => async (data: LocalAdoptionServer, callback?: (arg: string) => void) => {
	const validation = localAdoptionServerSchema.validate(data);

	if (validation.error) {
		callback?.('error');
		throw validation.error;
	}

	probe.localAdoptionServer = data;
};
