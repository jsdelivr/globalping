import { getAltIpsClient } from '../../lib/alt-ips-client.js';
import { altIpsSchema } from '../schema/probe-response-schema.js';
import type { Probe } from '../types.js';

export const handleAltIps = (probe: Probe) => (ipsToTokens: Record<string, string>): void => {
	const validation = altIpsSchema.validate(ipsToTokens);

	if (validation.error) {
		throw validation.error;
	}

	const altIpsClient = getAltIpsClient();
	altIpsClient.addAltIps(probe, validation.value);
};
