import type { SocketProbe } from '../types.js';
import { ipVersionSchema } from '../schema/probe-response-schema.js';

export const handleIsIPv4SupportedUpdate = (probe: SocketProbe) => (isIPv4Supported: boolean): void => {
	const validation = ipVersionSchema.validate(isIPv4Supported);

	if (validation.error) {
		throw validation.error;
	}

	probe.isIPv4Supported = validation.value;
};

export const handleIsIPv6SupportedUpdate = (probe: SocketProbe) => (isIPv6Supported: boolean): void => {
	const validation = ipVersionSchema.validate(isIPv6Supported);

	if (validation.error) {
		throw validation.error;
	}

	probe.isIPv6Supported = validation.value;
};
