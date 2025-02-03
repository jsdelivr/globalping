import Joi from 'joi';
import type { Probe, ProbeStats } from '../types.js';

const schema = Joi.object<ProbeStats>({
	cpu: Joi.object({
		load: Joi.array().items(Joi.object({
			usage: Joi.number().required(),
		})).required(),
	}).required(),
	jobs: Joi.object({
		count: Joi.number().required(),
	}).required(),
}).required();

export const handleStatsReport = (probe: Probe) => (report: ProbeStats): void => {
	const validation = schema.validate(report);

	if (validation.error) {
		throw validation.error;
	}

	probe.stats = validation.value;
};
