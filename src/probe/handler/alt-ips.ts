import { getAltIpsClient } from '../../lib/alt-ips-client.js';
import { altIpsSchema } from '../schema/probe-response-schema.js';
import type { Probe } from '../types.js';

export const handleAltIps = (probe: Probe) => async (ipsToTokens: Record<string, string>, callback: (addedAltIps: string[]) => void) => {
	const validation = altIpsSchema.validate(ipsToTokens);

	if (validation.error) {
		throw validation.error;
	}

	const altIpsClient = getAltIpsClient();
	const addedAltIps = await altIpsClient.addAltIps(probe, validation.value);
	callback(addedAltIps);
};
