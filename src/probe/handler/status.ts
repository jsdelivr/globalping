import type {Probe} from '../../probe/types.js';

export const handleStatusUpdate = (probe: Probe) => (status: Probe['status']): void => {
	probe.status = status;
};
