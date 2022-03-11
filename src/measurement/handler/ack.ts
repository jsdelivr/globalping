import type {Probe} from '../../probe/store.js';
import {getMeasurementRunner} from '../runner.js';

const runner = getMeasurementRunner();

export const handleMeasurementAck = (probe: Probe) => async (data: any, ack: () => void): Promise<void> => {
	await runner.addProbe(data.measurementId, data.id, probe).then(() => {
		ack();
	});
};
