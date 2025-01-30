import type { Probe } from '../../probe/types.js';
import type { MeasurementProgressMessage } from '../types.js';
import { getMeasurementRunner } from '../runner.js';
import { probeValidator } from '../../lib/probe-validator.js';

const runner = getMeasurementRunner();

export const handleMeasurementProgress = (probe: Probe) => async (data: MeasurementProgressMessage): Promise<void> => {
	await probeValidator.validateProbe(data.measurementId, data.testId, probe.uuid);
	await runner.recordProgress(data);
};
