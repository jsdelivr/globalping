import type { Probe } from '../types.js';

export const handleStatusUpdate = (probe: Probe) => (status: Probe['status']): void => {
	probe.status = status;
};
