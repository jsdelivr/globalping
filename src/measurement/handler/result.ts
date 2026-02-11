import type { SocketProbe } from '../../probe/types.js';
import type { MeasurementResultMessage } from '../types.js';
import type { MeasurementRunner } from '../runner.js';
import { getProbeValidator } from '../../lib/probe-validator.js';
import { resultSchema } from '../schema/probe-response-schema.js';

export const handleMeasurementResult = (probe: SocketProbe, measurementRunner: MeasurementRunner) => async (data: MeasurementResultMessage): Promise<void> => {
	await getProbeValidator().validateProbe(data.measurementId, data.testId, probe.uuid);

	const validation = resultSchema.validate(data);

	if (validation.error) {
		(data.measurementId && data.testId) && await measurementRunner.recordResult({
			measurementId: data.measurementId,
			testId: data.testId,
			result: {
				status: 'failed',
				rawOutput: 'The probe reported an invalid result.',
			},
		});

		throw validation.error;
	}

	await measurementRunner.recordResult(validation.value);
};
