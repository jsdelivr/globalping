import type {Probe} from '../../probe/types.js';
import type {MeasurementAckMessage} from '../types.js';

export const handleMeasurementAck = (_probe: Probe) => async (_data: MeasurementAckMessage, ack: () => void): Promise<void> => {
  ack();
  await Promise.resolve()
};
