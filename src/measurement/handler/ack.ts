import type { Probe } from '../../probe/types.js';
import { getMeasurementRunner } from '../runner.js';
import type { MeasurementAckMessage } from '../types.js';

const runner = getMeasurementRunner();

export const handleMeasurementAck = (probe: Probe) => async (data: MeasurementAckMessage, ack: () => void): Promise<void> => {
	await runner.addProbe(data.measurementId, data.id, probe).then(() => {
		ack();
	});
};
