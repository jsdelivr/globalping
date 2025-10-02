import type { SocketProbe } from '../../probe/types.js';
import { getProbeValidator } from '../../lib/probe-validator.js';
import { MeasurementRequestMessage } from '../types.js';

export const listenMeasurementRequest = (probe: SocketProbe) => (event: string, data: unknown) => {
	if (event !== 'probe:measurement:request') {
		return;
	}

	const message = data as MeasurementRequestMessage;
	getProbeValidator().addValidIds(message.measurementId, message.testId, probe.uuid);
};
