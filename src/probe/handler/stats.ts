import type { Probe, ProbeStats } from '../types.js';

export const handleStatsReport = (probe: Probe) => (report: ProbeStats): void => {
	probe.stats = report;
};
