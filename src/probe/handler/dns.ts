import type { Probe } from '../../probe/types.js';

export const handleDnsUpdate = (probe: Probe) => (list: string[]): void => {
	probe.resolvers = list;
};
