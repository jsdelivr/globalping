import { LogMessage } from './handler/logs.js';
import { getMeasurementRedisClient, RedisCluster } from '../lib/redis/measurement-client.js';

const getRedisProbeLogKey = (probeUuid: string) => `probe:${probeUuid}:logs`;

class ProbeLogStorage {
	private redisClient: RedisCluster;

	constructor () {
		this.redisClient = getMeasurementRedisClient();
	}

	async readLogs (probeUuid: string, since?: number) {
		const redisKey = getRedisProbeLogKey(probeUuid);
		let start = '-';

		if (since) {
			start = `${Math.floor(since)}-0`;
		}

		return this.redisClient.xRange(redisKey, start, '+');
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

export const probeLogStorage = new ProbeLogStorage();
