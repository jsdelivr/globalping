import { getAltIpsClient } from '../../lib/alt-ips-client.js';
import { altIpsSchema } from '../schema/probe-response-schema.js';
import type { SocketProbe } from '../types.js';

export const handleAltIps = (probe: SocketProbe) => async (ipsToTokens: [string, string][], callback: (result: { addedAltIps: string[]; rejectedIpsToReasons: Record<string, string> }) => void) => {
	const validation = altIpsSchema.validate(ipsToTokens);

	if (validation.error) {
		throw validation.error;
	}

	const altIpsClient = getAltIpsClient();
	const { addedAltIps, rejectedIpsToReasons } = await altIpsClient.addAltIps(probe, validation.value);
	callback({ addedAltIps, rejectedIpsToReasons });
};
