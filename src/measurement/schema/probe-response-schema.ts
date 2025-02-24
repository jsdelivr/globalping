import Joi from 'joi';
import { DnsRegularResult, DnsTraceResult, HttpResult, MeasurementProgressMessage, MeasurementResultMessage, MtrResult, PingResult, TestResult, TracerouteResult } from '../types.js';

export const progressSchema = Joi.object<MeasurementProgressMessage>({
	testId: Joi.string().max(1024).required(),
	measurementId: Joi.string().max(1024).required(),
	overwrite: Joi.boolean(),
	result: Joi.object({
		rawOutput: Joi.string().max(20200).allow('', null).required(),
		rawHeaders: Joi.string().max(10100).allow('', null),
		rawBody: Joi.string().max(10100).allow('', null),
	}).required(),
}).options({ convert: false });

export const pingResultSchema = Joi.object<PingResult>({
	status: Joi.string().valid('finished', 'failed').required(),
	rawOutput: Joi.string().max(10000).allow('').required(),
	resolvedAddress: Joi.string().max(1024).allow(null),
	resolvedHostname: Joi.string().max(1024).allow(null),
	timings: Joi.array().max(1024).items(Joi.object({
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
}).options({ convert: false });

export const tracerouteResultSchema = Joi.object<TracerouteResult>({
	status: Joi.string().valid('finished', 'failed').required(),
	rawOutput: Joi.string().max(10000).allow('').required(),
	resolvedAddress: Joi.string().max(1024).allow(null),
	resolvedHostname: Joi.string().max(1024).allow(null),
	hops: Joi.array().max(1024).items(Joi.object({
		resolvedAddress: Joi.string().max(1024).allow(null).required(),
		resolvedHostname: Joi.string().max(1024).allow(null).required(),
		timings: Joi.array().max(1024).items(Joi.object({
			rtt: Joi.number().required(),
		})).required(),
	})),
}).options({ convert: false });

export const dnsResultSchema = Joi.alternatives([
	Joi.object<TestResult & DnsRegularResult>({
		status: Joi.string().valid('finished', 'failed').required(),
		rawOutput: Joi.string().max(10000).allow('').required(),
		statusCodeName: Joi.string().max(1024).allow(null),
		statusCode: Joi.number().allow(null),
		resolver: Joi.string().max(1024).allow(null),
		timings: Joi.object({
			total: Joi.number().required(),
		}),
		answers: Joi.array().max(1024).items(Joi.alternatives([
			Joi.object({
				name: Joi.string().max(1024).required(),
				type: Joi.string().max(1024).required(),
				ttl: Joi.number().required(),
				class: Joi.string().max(1024).required(),
				value: Joi.string().max(1024).required(),
			}),
			Joi.object({}),
		])),
	}),
	Joi.object<TestResult & DnsTraceResult>({
		status: Joi.string().valid('finished', 'failed').required(),
		rawOutput: Joi.string().max(10000).allow('').required(),
		hops: Joi.array().max(1024).items(Joi.object({
			resolver: Joi.string().max(1024).allow(null).required(),
			timings: Joi.object({
				total: Joi.number().required(),
			}).required(),
			answers: Joi.array().max(1024).items(Joi.alternatives([
				Joi.object({
					name: Joi.string().max(1024).required(),
					type: Joi.string().max(1024).required(),
					ttl: Joi.number().required(),
					class: Joi.string().max(1024).required(),
					value: Joi.string().max(1024).required(),
				}),
				Joi.object({}),
			])).required(),
		})),
	}),
]).options({ convert: false });

export const mtrResultSchema = Joi.object<MtrResult>({
	status: Joi.string().valid('finished', 'failed').required(),
	rawOutput: Joi.string().max(10000).allow('').required(),
	resolvedAddress: Joi.string().max(1024).allow(null),
	resolvedHostname: Joi.string().max(1024).allow(null),
	hops: Joi.array().max(1024).items(Joi.object({
		asn: Joi.array().max(1024).items(Joi.number()).required(),
		resolvedAddress: Joi.string().max(1024).allow(null).required(),
		resolvedHostname: Joi.string().max(1024).allow(null).required(),
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
		timings: Joi.array().max(1024).items(Joi.object({
			rtt: Joi.number(),
		})).required(),
	})),
}).options({ convert: false });

export const httpResultSchema = Joi.object<HttpResult>({
	status: Joi.string().valid('finished', 'failed').required(),
	rawOutput: Joi.string().max(20200).allow('').required(),
	rawHeaders: Joi.string().max(10100).allow('', null),
	rawBody: Joi.string().max(10100).allow('', null),
	resolvedAddress: Joi.string().max(1024).allow(null),
	headers: Joi.object().max(1024).pattern(Joi.string().max(1024), Joi.alternatives([
		Joi.string().max(10000).allow(''),
		Joi.array().max(1024).items(Joi.string().max(10000).allow('')),
	])),
	truncated: Joi.boolean(),
	statusCode: Joi.number().allow(null),
	statusCodeName: Joi.string().max(1024).allow('', null),
	timings: Joi.object().max(1024).pattern(Joi.string().max(1024), Joi.number().allow(null)),
	tls: Joi.object({
		authorized: Joi.boolean().required(),
		protocol: Joi.string().max(1024).required(),
		cipherName: Joi.string().max(1024).required(),
		createdAt: Joi.string().max(1024).allow(null).required(),
		expiresAt: Joi.string().max(1024).allow(null).required(),
		error: Joi.string().max(1024),
		subject: Joi.object({
			CN: Joi.string().max(20000).allow(null).required(),
			alt: Joi.string().max(20000).allow(null).required(),
		}).required(),
		issuer: Joi.object({
			C: Joi.string().max(20000).allow(null).required(),
			O: Joi.string().max(20000).allow(null).required(),
			CN: Joi.string().max(20000).allow(null).required(),
		}).required(),
		keyType: Joi.string().max(1024).valid('RSA', 'EC').allow(null).required(),
		keyBits: Joi.number().allow(null).required(),
		serialNumber: Joi.string().max(1024).required(),
		fingerprint256: Joi.string().max(1024).required(),
		publicKey: Joi.string().max(10000).allow(null).required(),
	}).allow(null),
}).options({ convert: false });

export const resultSchema = Joi.object<MeasurementResultMessage>({
	testId: Joi.string().max(1024).required(),
	measurementId: Joi.string().max(1024).required(),
	result: Joi.alternatives([
		pingResultSchema,
		tracerouteResultSchema,
		dnsResultSchema,
		mtrResultSchema,
		httpResultSchema,
	]).required(),
}).required();
