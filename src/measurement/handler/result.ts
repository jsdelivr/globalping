import type { Probe } from '../../probe/types.js';
import type { MeasurementResultMessage } from '../types.js';
import { getMeasurementRunner } from '../runner.js';
import { probeValidator } from '../../lib/probe-validator.js';

const runner = getMeasurementRunner();

export const handleMeasurementResult = (probe: Probe) => async (data: MeasurementResultMessage): Promise<void> => {
	await probeValidator.validateProbe(data.measurementId, data.testId, probe.uuid);
	await runner.recordResult(data);
};
