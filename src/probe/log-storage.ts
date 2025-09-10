import { LogMessage } from './handler/logs.js';
import { getMeasurementRedisClient, RedisCluster } from '../lib/redis/measurement-client.js';

const REDIS_ID_REGEX = /^\d+-\d+$/;

const getRedisProbeLogKey = (probeUuid: string) => `probe:${probeUuid}:logs`;

class ProbeLogStorage {
	constructor (private readonly redisClient: RedisCluster) {}

	async readLogs (probeUuid: string, after?: string) {
		const redisKey = getRedisProbeLogKey(probeUuid);
		const startId = after && REDIS_ID_REGEX.test(after) ? `(${after}` : '-';

		return this.redisClient.xRange(redisKey, startId, '+');
	}

	async writeLogs (probeUuid: string, logMessage: LogMessage) {
		const redisTransaction = this.redisClient.multi();
		const redisKey = getRedisProbeLogKey(probeUuid);
		const { skipped, logs } = logMessage;

		const addMessage = (message: Record<string, string>) => {
			redisTransaction.xAdd(redisKey, '*', message, { TRIM: { strategy: 'MAXLEN', strategyModifier: '~', threshold: 1000 } });
		};

		if (skipped > 0) {
			addMessage({ message: `...${skipped} messages skipped...` });
		}

		logs.forEach(addMessage);

		redisTransaction.pExpire(redisKey, 24 * 60 * 60 * 1000);
		await redisTransaction.exec();
	}
}

let probeLogStorage: ProbeLogStorage;

export const getProbeLogStorage = () => {
	if (!probeLogStorage) {
		probeLogStorage = new ProbeLogStorage(getMeasurementRedisClient());
	}

	return probeLogStorage;
};
