import type { AltIpsClient } from '../../lib/alt-ips-client.js';
import { scopedLogger } from '../../lib/logger.js';
import { altIpsSchema } from '../schema/probe-response-schema.js';
import type { SocketProbe } from '../types.js';

const logger = scopedLogger('alt-ips');

export const handleAltIps = (probe: SocketProbe, altIpsClient: AltIpsClient) => async (ipsToTokens: [string, string][], callback?: (result: { addedAltIps: string[]; rejectedIpsToReasons: Record<string, string> }) => void) => {
	const validation = altIpsSchema.validate(ipsToTokens);

	if (validation.error) {
		throw validation.error;
	}

	const { addedAltIps, rejectedIpsToReasons } = await altIpsClient.addAltIps(probe, validation.value);

	if (callback) {
		callback({ addedAltIps, rejectedIpsToReasons });
	} else {
		logger.warn('Missing ack callback for alt IP update.', { client: { id: probe.client, ip: probe.ipAddress, version: probe.version }, probe: { uuid: probe.uuid } });
	}
};
