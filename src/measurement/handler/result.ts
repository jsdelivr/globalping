import Joi from 'joi';
import type { Probe } from '../../probe/types.js';
import type { MeasurementResultMessage, PingResult } from '../types.js';
import { getMeasurementRunner } from '../runner.js';
import { getProbeValidator } from '../../lib/probe-validator.js';

const pingResultSchema = Joi.object<PingResult>({
	status: Joi.string().required(),
	rawOutput: Joi.string().required(),
	resolvedAddress: Joi.string().required().allow(null),
	resolvedHostname: Joi.string().required().allow(null),
	timings: Joi.array().items(Joi.object({
		rtt: Joi.number().required(),
		ttl: Joi.number().required(),
	})).required(),
	stats: Joi.object({
		min: Joi.number().required().allow(null),
		max: Joi.number().required().allow(null),
		avg: Joi.number().required().allow(null),
		total: Joi.number().required().allow(null),
		loss: Joi.number().required().allow(null),
		rcv: Joi.number().required().allow(null),
		drop: Joi.number().required().allow(null),
	}).required(),
});

const schema = Joi.object<MeasurementResultMessage>({
	testId: Joi.string().required(),
	measurementId: Joi.string().required(),
	overwrite: Joi.boolean(),
	result: Joi.alternatives([
		pingResultSchema,
	]).required(),
}).required();

const runner = getMeasurementRunner();

export const handleMeasurementResult = (probe: Probe) => async (data: MeasurementResultMessage): Promise<void> => {
	const validation = schema.validate(data);

	if (validation.error) {
		throw validation.error;
	}

	await getProbeValidator().validateProbe(data.measurementId, data.testId, probe.uuid);
	await runner.recordResult(data);
};
