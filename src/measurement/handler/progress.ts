import type { SocketProbe } from '../../probe/types.js';
import type { MeasurementProgressMessage } from '../types.js';
import type { MeasurementRunner } from '../runner.js';
import { getProbeValidator } from '../../lib/probe-validator.js';
import { progressSchema } from '../schema/probe-response-schema.js';

export const handleMeasurementProgress = (probe: SocketProbe, measurementRunner: MeasurementRunner) => async (data: MeasurementProgressMessage): Promise<void> => {
	const validation = progressSchema.validate(data);

	if (validation.error) {
		throw validation.error;
	}

	await getProbeValidator().validateProbe(validation.value.measurementId, validation.value.testId, probe.uuid);
	await measurementRunner.recordProgress(validation.value);
};
