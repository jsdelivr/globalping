import type { AltIpsClient } from '../../lib/alt-ips-client.js';
import { altIpsSchema } from '../schema/probe-response-schema.js';
import type { SocketProbe } from '../types.js';

export const handleAltIps = (probe: SocketProbe, altIpsClient: AltIpsClient) => async (ipsToTokens: [string, string][], callback: (result: { addedAltIps: string[]; rejectedIpsToReasons: Record<string, string> }) => void) => {
	const validation = altIpsSchema.validate(ipsToTokens);

	if (validation.error) {
		throw validation.error;
	}

	const { addedAltIps, rejectedIpsToReasons } = await altIpsClient.addAltIps(probe, validation.value);
	callback({ addedAltIps, rejectedIpsToReasons });
};
