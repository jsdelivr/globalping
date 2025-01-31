import config from 'config';
import TTLCache from '@isaacs/ttlcache';
import { type RedisCluster, getMeasurementRedisClient } from './redis/measurement-client.js';

export class ProbeValidator {
	private readonly measurementIdToTests = new TTLCache<string, Map<string, string>>({
		ttl: (config.get<number>('measurement.timeout') + 30) * 1000,
	});

	constructor (private readonly redis: RedisCluster) {}

	addValidIds (measurementId: string, testId: string, probeUuid: string): void {
		const measurement = this.measurementIdToTests.get(measurementId);

		if (!measurement) {
			this.measurementIdToTests.set(measurementId, new Map([ [ testId, probeUuid ] ]));
		} else {
			measurement.set(testId, probeUuid);
		}
	}

	async validateProbe (measurementId: string, testId: string, probeUuid: string): Promise<void> {
		const measurement = this.measurementIdToTests.get(measurementId);
		let probeId = measurement && measurement.get(testId);

		if (!probeId) {
			probeId = await this.getProbeIdFromRedis(measurementId, testId);
		}

		if (!probeId) {
			throw new Error(`Probe ID not found for measurement ID: ${measurementId}, test ID: ${testId}`);
		} else if (probeId !== probeUuid) {
			throw new Error(`Probe ID is wrong for measurement ID: ${measurementId}, test ID: ${testId}. Expected: ${probeId}, actual: ${probeUuid}`);
		}
	}

	async getProbeIdFromRedis (measurementId: string, testId: string) {
		return this.redis.hGet('gp:test-to-probe', `${measurementId}_${testId}`);
	}
}

let probeValidator: ProbeValidator;

export const getProbeValidator = () => {
	if (!probeValidator) {
		probeValidator = new ProbeValidator(getMeasurementRedisClient());
	}

	return probeValidator;
};
