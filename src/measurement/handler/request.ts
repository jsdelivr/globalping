import type { Probe } from '../../probe/types.js';
import { probeValidator } from '../../lib/probe-validator.js';
import { MeasurementRequestMessage } from '../types.js';

export const listenMeasurementRequest = (probe: Probe) => (event: string, data: unknown) => {
	if (event !== 'probe:measurement:request') {
		return;
	}

	const message = data as MeasurementRequestMessage;
	probeValidator.addValidIds(message.measurementId, message.testId, probe.uuid);
};
