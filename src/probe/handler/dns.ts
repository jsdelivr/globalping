import { dnsSchema } from '../schema/probe-response-schema.js';
import type { Probe } from '../types.js';

export const handleDnsUpdate = (probe: Probe) => (list: string[]): void => {
	const validation = dnsSchema.validate(list);

	if (validation.error) {
		throw validation.error;
	}

	probe.resolvers = validation.value;
};
