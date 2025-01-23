import type { Probe } from '../../probe/types.js';
import { probeValidator } from '../../lib/probe-validator.js';

export const listenMeasurementRequest = (probe: Probe) => (event: string, data: unknown) => {
	if (event !== 'probe:measurement:request') {
		return;
	}

	probeValidator.addValidIds(data.measurementId, data.testId, probe.uuid);
};
