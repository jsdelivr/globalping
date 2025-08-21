import { Probe } from '../types.js';
import { adoptedProbes } from '../../lib/ws/server.js';
import { getMeasurementRedisClient } from '../../lib/redis/measurement-client.js';

export type LogMessage = {
	skipped: number;
	logs: {
		message: string;
		timestamp: string;
		level: string;
		type: string;
	}[];
};

const TRIM_OPTIONS = { TRIM: { strategy: 'MAXLEN', strategyModifier: '~', threshold: 1000 } } as const;

export const getRedisProbeLogKey = (probeId: string) => `probe:${probeId}:logs`;

export const handleNewLogs = (probe: Probe) => async (logMessage: LogMessage) => {
	const probeId = adoptedProbes.getByIp(probe.ipAddress)?.id;

	if (!probeId) {
		return;
	}

	const redisTransaction = getMeasurementRedisClient().multi();
	const redisKey = getRedisProbeLogKey(probeId);
	const { skipped, logs } = logMessage;

	const addMessage = (message: Record<string, string>) => {
		redisTransaction.xAdd(redisKey, '*', message, TRIM_OPTIONS);
	};

	if (skipped > 0) {
		addMessage({ message: `<${skipped} messages skipped>` });
	}

	logs.forEach(addMessage);

	redisTransaction.pExpire(redisKey, 24 * 60 * 60 * 1000);
	await redisTransaction.exec();
};
