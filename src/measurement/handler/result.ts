import Joi from 'joi';
import type { Probe } from '../../probe/types.js';
import type { DnsRegularResult, DnsTraceResult, MeasurementResultMessage, PingResult, TestResult, TracerouteResult } from '../types.js';
import { getMeasurementRunner } from '../runner.js';
import { getProbeValidator } from '../../lib/probe-validator.js';

const pingResultSchema = Joi.object<PingResult>({
	status: Joi.string().valid('finished', 'failed').required(),
	rawOutput: Joi.string().required(),
	resolvedAddress: Joi.string().allow(null),
	resolvedHostname: Joi.string().allow(null),
	timings: Joi.array().items(Joi.object({
		rtt: Joi.number().required(),
		ttl: Joi.number().required(),
	})),
	stats: Joi.object({
		min: Joi.number().allow(null).required(),
		max: Joi.number().allow(null).required(),
		avg: Joi.number().allow(null).required(),
		total: Joi.number().allow(null).required(),
		loss: Joi.number().allow(null).required(),
		rcv: Joi.number().allow(null).required(),
		drop: Joi.number().allow(null).required(),
	}),
});

const tracerouteResultSchema = Joi.object<TracerouteResult>({
	status: Joi.string().valid('finished', 'failed').required(),
	rawOutput: Joi.string().required(),
	resolvedAddress: Joi.string().allow(null),
	resolvedHostname: Joi.string().allow(null),
	hops: Joi.array().items(Joi.object({
		resolvedAddress: Joi.string().allow(null).required(),
		resolvedHostname: Joi.string().allow(null).required(),
		timings: Joi.array().items({
			rtt: Joi.number().required(),
		}).required(),
	})),
});

const dnsResultSchema = Joi.alternatives([
	Joi.object<TestResult & DnsRegularResult>({
		status: Joi.string().valid('finished', 'failed').required(),
		rawOutput: Joi.string().required(),
		statusCodeName: Joi.string().required(),
		statusCode: Joi.number().allow(null).required(),
		resolver: Joi.string().allow(null).required(),
		timings: Joi.object({
			total: Joi.number().allow(null),
		}).required(),
		answers: Joi.array().items(Joi.alternatives([
			Joi.object({
				name: Joi.string().allow(null),
				type: Joi.string().allow(null),
				ttl: Joi.number(),
				class: Joi.string().allow(null),
				value: Joi.string(),
			}),
			Joi.object({}),
		])).required(),
	}),
	Joi.object<TestResult & DnsTraceResult>({
		status: Joi.string().valid('finished', 'failed').required(),
		rawOutput: Joi.string().required(),
		hops: Joi.array().items(Joi.object({
			resolver: Joi.string().allow(null).required(),
			timings: Joi.object({
				total: Joi.number().allow(null),
			}).required(),
			answers: Joi.array().items(Joi.alternatives([
				Joi.object({
					name: Joi.string().allow(null),
					type: Joi.string().allow(null),
					ttl: Joi.number(),
					class: Joi.string().allow(null),
					value: Joi.string(),
				}),
				Joi.object({}),
			])).required(),
		})),
	}),
]);

const schema = Joi.object<MeasurementResultMessage>({
	testId: Joi.string().required(),
	measurementId: Joi.string().required(),
	overwrite: Joi.boolean(),
	result: Joi.alternatives([
		pingResultSchema,
		tracerouteResultSchema,
		dnsResultSchema,
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
