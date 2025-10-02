import { dnsSchema } from '../schema/probe-response-schema.js';
import type { SocketProbe } from '../types.js';

export const handleDnsUpdate = (probe: SocketProbe) => (list: string[]): void => {
	const validation = dnsSchema.validate(list);

	if (validation.error) {
		throw validation.error;
	}

	probe.resolvers = validation.value;
};
