import type { Probe } from '../../probe/types.js';
import type { MeasurementProgressMessage } from '../types.js';
import { getMeasurementRunner } from '../runner.js';
import { getProbeValidator } from '../../lib/probe-validator.js';
import { progressSchema } from '../schema/probe-response-schema.js';

const runner = getMeasurementRunner();

export const handleMeasurementProgress = (probe: Probe) => async (data: MeasurementProgressMessage): Promise<void> => {
	const validation = progressSchema.validate(data);

	if (validation.error) {
		throw validation.error;
	}

	await getProbeValidator().validateProbe(validation.value.measurementId, validation.value.testId, probe.uuid);
	await runner.recordProgress(validation.value);
};
