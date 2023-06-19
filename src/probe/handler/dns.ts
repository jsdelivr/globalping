import type { Probe } from '../types.js';

export const handleDnsUpdate = (probe: Probe) => (list: string[]): void => {
	probe.resolvers = list;
};
