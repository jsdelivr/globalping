import { SocketProbe } from '../types.js';
import { logMessageSchema } from '../schema/probe-response-schema.js';
import { getProbeLogStorage } from '../logs-storage.js';
import type { AdoptedProbes } from '../../lib/override/adopted-probes.js';

export type LogMessage = {
	skipped: number;
	logs: {
		message: string;
		timestamp: string;
		level: string;
		scope: string;
	}[];
};

const probeLogStorage = getProbeLogStorage();

export const handleNewLogs = (probe: SocketProbe, adoptedProbes: AdoptedProbes) => async (logMessage: LogMessage, callback?: (arg: string) => void) => {
	const validation = logMessageSchema.validate(logMessage);

	if (validation.error) {
		callback?.('error');
		throw validation.error;
	}

	try {
		const uuidAdoption = adoptedProbes.getByUuid(probe.uuid);
		const ipAdoption = adoptedProbes.getByIp(probe.ipAddress);
		const trackScopes = Boolean(uuidAdoption?.userId || ipAdoption?.userId);

		await probeLogStorage.writeLogs(probe.uuid, logMessage, trackScopes);
	} catch (error: unknown) {
		callback?.('error');
		throw error;
	}

	callback?.('success');
};
