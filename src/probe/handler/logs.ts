import { Probe } from '../types.js';
import { logMessageSchema } from '../schema/probe-response-schema.js';
import { probeLogStorage } from '../log-storage.js';

export type LogMessage = {
	skipped: number;
	logs: {
		message: string;
		timestamp: string;
		level: string;
		scope: string;
	}[];
};

export const handleNewLogs = (probe: Probe) => async (logMessage: LogMessage, callback?: (arg: string) => void) => {
	const validation = logMessageSchema.validate(logMessage);

	if (validation.error) {
		callback?.('error');
		throw validation.error;
	}

	await probeLogStorage.writeLogs(probe.uuid, logMessage);
	callback?.('success');
};
