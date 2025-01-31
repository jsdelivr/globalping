import type { Probe } from '../../probe/types.js';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const handleMeasurementAck = (_probe: Probe) => async (_data: null, ack: () => void): Promise<void> => {
	ack();
};
