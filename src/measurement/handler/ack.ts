import type { Probe } from '../../probe/types.js';
import type { MeasurementAckMessage } from '../types.js';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const handleMeasurementAck = (_probe: Probe) => async (_data: MeasurementAckMessage, ack: () => void): Promise<void> => {
	ack();
};
