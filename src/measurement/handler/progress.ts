import { getMeasurementRunner } from '../runner.js';
import type { MeasurementProgressMessage } from '../types.js';

const runner = getMeasurementRunner();

export const handleMeasurementProgress = async (data: MeasurementProgressMessage): Promise<void> => {
	await runner.recordProgress(data);
};
