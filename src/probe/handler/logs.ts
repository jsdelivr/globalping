import { SocketProbe } from '../types.js';
import { logMessageSchema } from '../schema/probe-response-schema.js';
import { getProbeLogStorage } from '../logs-storage.js';

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

export const handleNewLogs = (probe: SocketProbe) => async (logMessage: LogMessage, callback?: (response: 'success' | 'discard') => void) => {
	const validation = logMessageSchema.validate(logMessage);

	if (validation.error) {
		callback?.('discard');
		throw validation.error;
	}

	await probeLogStorage.writeLogs(probe.uuid, logMessage);
	callback?.('success');
};
