import Joi from 'joi';
import type { Probe } from '../../probe/types.js';
import type { MeasurementProgressMessage } from '../types.js';
import { getMeasurementRunner } from '../runner.js';
import { getProbeValidator } from '../../lib/probe-validator.js';

const schema = Joi.object<MeasurementProgressMessage>({
	testId: Joi.string().required(),
	measurementId: Joi.string().required(),
	overwrite: Joi.boolean(),
	result: Joi.object({
		rawOutput: Joi.string().allow('', null).required(),
		rawHeaders: Joi.string().allow('', null),
		rawBody: Joi.string().allow('', null),
	}).required(),
}).required();

const runner = getMeasurementRunner();

export const handleMeasurementProgress = (probe: Probe) => async (data: MeasurementProgressMessage): Promise<void> => {
	const validation = schema.validate(data);

	if (validation.error) {
		throw validation.error;
	}

	await getProbeValidator().validateProbe(validation.value.measurementId, validation.value.testId, probe.uuid);
	await runner.recordProgress(validation.value);
};
