import config from 'config';
import TTLCache from '@isaacs/ttlcache';
import { type RedisCluster, getMeasurementRedisClient } from './redis/measurement-client.js';

export class ProbeValidator {
	private readonly testIdToProbeId = new TTLCache<string, string>({
		ttl: (config.get<number>('measurement.timeout') + 30) * 1000,
	});

	constructor (private readonly redis: RedisCluster) {}

	addValidIds (measurementId: string, testId: string, probeUuid: string): void {
		const key = ProbeValidator.getKey(measurementId, testId);
		this.testIdToProbeId.set(key, probeUuid);
	}

	async validateProbe (measurementId: string, testId: string, probeUuid: string): Promise<void> {
		const key = ProbeValidator.getKey(measurementId, testId);
		let probeId = this.testIdToProbeId.get(key);

		if (!probeId) {
			probeId = await this.getProbeIdFromRedis(key);
		}

		if (!probeId) {
			throw new Error(`Probe ID not found for key ${key}`);
		} else if (probeId !== probeUuid) {
			throw new Error(`Probe ID is wrong for key ${key}. Expected: ${probeId}, actual: ${probeUuid}`);
		}
	}

	async getProbeIdFromRedis (key: string) {
		return this.redis.hGet('gp:test-to-probe', key);
	}

	static getKey (measurementId: string, testId: string) {
		return `${measurementId}_${testId}`;
	}
}

let probeValidator: ProbeValidator;

export const getProbeValidator = () => {
	if (!probeValidator) {
		probeValidator = new ProbeValidator(getMeasurementRedisClient());
	}

	return probeValidator;
};
