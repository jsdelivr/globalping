import type { Probe, ProbeStats } from '../types.js';
import { statsSchema } from '../schema/probe-response-schema.js';

export const handleStatsReport = (probe: Probe) => (report: ProbeStats): void => {
	const validation = statsSchema.validate(report);

	if (validation.error) {
		throw validation.error;
	}

	probe.stats = validation.value;
};
