import TTLCache from '@isaacs/ttlcache';

export class ProbeValidator {
	private readonly testIdToProbeId = new TTLCache<string, string>({ ttl: 60 * 1000 });

	addValidIds (measurementId: string, testId: string, probeUuid: string): void {
		const key = ProbeValidator.getKey(measurementId, testId);
		this.testIdToProbeId.set(key, probeUuid);
	}

	validateProbe (measurementId: string, testId: string, probeUuid: string): void {
		const key = ProbeValidator.getKey(measurementId, testId);
		const probeId = this.testIdToProbeId.get(key);

		if (!probeId) {
			throw new Error(`Probe ID not found for key ${key}`);
		} else if (probeId !== probeUuid) {
			throw new Error(`Probe ID is wrong for key ${key}. Expected: ${probeId}, actual: ${probeUuid}`);
		}
	}

	static getKey (measurementId: string, testId: string) {
		return `${measurementId}-${testId}`;
	}
}

export const probeValidator = new ProbeValidator();
