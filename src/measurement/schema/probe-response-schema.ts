import Joi from 'joi';
import { DnsRegularResult, DnsTraceResult, HttpResult, MeasurementProgressMessage, MeasurementResultMessage, MtrResult, PingResult, TestResult, TracerouteResult } from '../types.js';

export const progressSchema = Joi.object<MeasurementProgressMessage>({
	testId: Joi.string().required(),
	measurementId: Joi.string().required(),
	overwrite: Joi.boolean(),
	result: Joi.object({
		rawOutput: Joi.string().allow('', null).required(),
		rawHeaders: Joi.string().allow('', null),
		rawBody: Joi.string().allow('', null),
	}).required(),
}).required();

const pingResultSchema = Joi.object<PingResult>({
	status: Joi.string().valid('finished', 'failed').required(),
	rawOutput: Joi.string().allow('').required(),
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
	rawOutput: Joi.string().allow('').required(),
	resolvedAddress: Joi.string().allow(null),
	resolvedHostname: Joi.string().allow(null),
	hops: Joi.array().items(Joi.object({
		resolvedAddress: Joi.string().allow(null).required(),
		resolvedHostname: Joi.string().allow(null).required(),
		timings: Joi.array().items(Joi.object({
			rtt: Joi.number().required(),
		})).required(),
	})),
});

const dnsResultSchema = Joi.alternatives([
	Joi.object<TestResult & DnsRegularResult>({
		status: Joi.string().valid('finished', 'failed').required(),
		rawOutput: Joi.string().allow('').required(),
		statusCodeName: Joi.string().allow(null),
		statusCode: Joi.number().allow(null),
		resolver: Joi.string().allow(null),
		timings: Joi.object({
			total: Joi.number().required(),
		}),
		answers: Joi.array().items(Joi.alternatives([
			Joi.object({
				name: Joi.string().required(),
				type: Joi.string().required(),
				ttl: Joi.number().required(),
				class: Joi.string().required(),
				value: Joi.string().required(),
			}),
			Joi.object({}),
		])),
	}),
	Joi.object<TestResult & DnsTraceResult>({
		status: Joi.string().valid('finished', 'failed').required(),
		rawOutput: Joi.string().allow('').required(),
		hops: Joi.array().items(Joi.object({
			resolver: Joi.string().allow(null).required(),
			timings: Joi.object({
				total: Joi.number().required(),
			}).required(),
			answers: Joi.array().items(Joi.alternatives([
				Joi.object({
					name: Joi.string().required(),
					type: Joi.string().required(),
					ttl: Joi.number().required(),
					class: Joi.string().required(),
					value: Joi.string().required(),
				}),
				Joi.object({}),
			])).required(),
		})),
	}),
]);

const mtrResultSchema = Joi.object<MtrResult>({
	status: Joi.string().valid('finished', 'failed').required(),
	rawOutput: Joi.string().allow('').required(),
	resolvedAddress: Joi.string().allow(null),
	resolvedHostname: Joi.string().allow(null),
	hops: Joi.array().items(Joi.object({
		asn: Joi.array().items(Joi.number()).required(),
		resolvedAddress: Joi.string().allow(null).required(),
		resolvedHostname: Joi.string().allow(null).required(),
		stats: Joi.object({
			min: Joi.number().required(),
			max: Joi.number().required(),
			avg: Joi.number().required(),
			stDev: Joi.number().required(),
			jMin: Joi.number().required(),
			jMax: Joi.number().required(),
			jAvg: Joi.number().required(),
			total: Joi.number().required(),
			loss: Joi.number().required(),
			rcv: Joi.number().required(),
			drop: Joi.number().required(),
		}).required(),
		timings: Joi.array().items(Joi.object({
			seq: Joi.string(),
			rtt: Joi.number(),
		})).required(),
	})),
});

const httpResultSchema = Joi.object<HttpResult>({
	status: Joi.string().valid('finished', 'failed').required(),
	rawOutput: Joi.string().allow('').required(),
	resolvedAddress: Joi.string().allow(null),
	headers: Joi.object().pattern(Joi.string(), Joi.alternatives([
		Joi.string().allow(''),
		Joi.number(),
		Joi.array().items(Joi.string().allow('')),
	])),
	rawHeaders: Joi.string().allow('', null),
	rawBody: Joi.string().allow('', null),
	truncated: Joi.boolean(),
	statusCode: Joi.number().allow(null),
	statusCodeName: Joi.string().allow(null),
	timings: Joi.object().pattern(Joi.string(), Joi.number().allow(null)),
	tls: Joi.object({
		authorized: Joi.boolean().required(),
		createdAt: Joi.string(),
		expiresAt: Joi.string(),
		error: Joi.string(),
		subject: Joi.object().pattern(Joi.string(), Joi.string()).required(),
		issuer: Joi.object().pattern(Joi.string(), Joi.alternatives(
			Joi.string(),
			Joi.array().items(Joi.string()),
		)).required(),
		keyType: Joi.string().valid('RSA', 'EC').allow(null).required(),
		keyBits: Joi.number().allow(null).required(),
		serialNumber: Joi.string().required(),
		fingerprint256: Joi.string().required(),
		publicKey: Joi.string().allow(null).required(),
	}).allow(null),
});

export const resultSchema = Joi.object<MeasurementResultMessage>({
	testId: Joi.string().required(),
	measurementId: Joi.string().required(),
	result: Joi.alternatives([
		pingResultSchema,
		tracerouteResultSchema,
		dnsResultSchema,
		mtrResultSchema,
		httpResultSchema,
	]).required(),
}).required();
