import type {
	Probe,
	ProbeStats,
} from '../../probe/types.js';

export const handleStatsReport = (probe: Probe) => (report: ProbeStats): void => {
	probe.stats = report;
};
