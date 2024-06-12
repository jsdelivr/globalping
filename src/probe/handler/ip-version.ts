import type { Probe } from '../types.js';

export const handleIsIPv4SupportedUpdate = (probe: Probe) => (isIPv4Supported: boolean): void => {
	probe.isIPv4Supported = isIPv4Supported;
};

export const handleIsIPv6SupportedUpdate = (probe: Probe) => (isIPv6Supported: boolean): void => {
	probe.isIPv6Supported = isIPv6Supported;
};
