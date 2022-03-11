import {getMeasurementRunner} from '../runner.js';
import type {MeasurementResultMessage} from '../types.js';

const runner = getMeasurementRunner();

export const handleMeasurementProgress = async (data: MeasurementResultMessage): Promise<void> => {
	await runner.recordProgress(data);
};
