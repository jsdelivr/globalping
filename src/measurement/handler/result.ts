import type {MeasurementResultMessage} from '../types.js';
import {getMeasurementRunner} from '../runner.js';

const runner = getMeasurementRunner();

export const handleMeasurementResult = async (data: MeasurementResultMessage): Promise<void> => {
	await runner.recordResult(data);
};
