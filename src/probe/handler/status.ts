import type {Probe} from '../../probe/types.js';

export const handleStatusReady = (probe: Probe) => (): void => {
	probe.ready = true;
};

export const handleStatusNotReady = (probe: Probe) => (): void => {
	probe.ready = false;
};

