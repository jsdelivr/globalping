import { defineScript } from 'redis';
import type { HttpProgress, MeasurementRecord, MeasurementResultMessage, TestProgress } from '../../measurement/types.js';

type RecordProgressScript = {
	NUMBER_OF_KEYS: number;
	SCRIPT: string;
	transformArguments (measurementId: string, testId: string, progress: TestProgress | HttpProgress): string[];
	transformReply (): null;
} & {
	SHA1: string;
};

type RecordProgressAppendScript = {
	NUMBER_OF_KEYS: number;
	SCRIPT: string;
	transformArguments (measurementId: string, testId: string, progress: TestProgress | HttpProgress): string[];
	transformReply (): null;
} & {
	SHA1: string;
};

type RecordResultScript = {
	NUMBER_OF_KEYS: number;
	SCRIPT: string;
	transformArguments (measurementId: string, testId: string, data: MeasurementResultMessage['result']): string[];
	transformReply (reply: number): boolean;
} & {
	SHA1: string;
};

type MarkFinishedScript = {
	NUMBER_OF_KEYS: number;
	SCRIPT: string;
	transformArguments (measurementId: string): string[];
	transformReply (reply: string): MeasurementRecord | null;
} & {
	SHA1: string;
};

export type RedisScripts = {
	recordProgress: RecordProgressScript;
	recordProgressAppend: RecordProgressAppendScript;
	recordResult: RecordResultScript;
	markFinished: MarkFinishedScript;
};

const recordProgress: RecordProgressScript = defineScript({
	FIRST_KEY_INDEX: 0, // Needed in clusters: https://github.com/redis/node-redis/issues/2521
	NUMBER_OF_KEYS: 2,
	SCRIPT: `
	local keyMeasurementResults = KEYS[1]
	local keyMeasurementAwaiting = KEYS[2]
	local rawOutputKey = ARGV[1]
	local rawOutputValue = ARGV[2]
	local rawHeadersKey = ARGV[3]
	local rawHeadersValue = ARGV[4]
	local rawBodyKey = ARGV[5]
	local rawBodyValue = ARGV[6]
	local date = ARGV[7]

	local probesAwaiting = redis.call('GET', keyMeasurementAwaiting)
	if not probesAwaiting then
		return
	end

	redis.call('JSON.SET', keyMeasurementResults, rawOutputKey, rawOutputValue)

	if rawHeadersValue ~= 'nil' then
		redis.call('JSON.SET', keyMeasurementResults, rawHeadersKey, rawHeadersValue)
	end

	if rawBodyValue ~= 'nil' then
		redis.call('JSON.SET', keyMeasurementResults, rawBodyKey, rawBodyValue)
	end

	redis.call('JSON.SET', keyMeasurementResults, '$.updatedAt', date)
	`,
	transformArguments (measurementId, testId, progress) {
		return [
			// keys
			`gp:m:{${measurementId}}:results`,
			`gp:m:{${measurementId}}:probes_awaiting`,
			// values
			`$.results[${testId}].result.rawOutput`,
			JSON.stringify(progress.rawOutput),
			`$.results[${testId}].result.rawHeaders`,
			'rawHeaders' in progress ? JSON.stringify(progress.rawHeaders) : 'nil',
			`$.results[${testId}].result.rawBody`,
			'rawBody' in progress ? JSON.stringify(progress.rawBody) : 'nil',
			`"${new Date().toISOString()}"`,
		];
	},
	transformReply () {
		return null;
	},
});

const recordProgressAppend: RecordProgressAppendScript = defineScript({
	FIRST_KEY_INDEX: 0, // Needed in clusters: https://github.com/redis/node-redis/issues/2521
	NUMBER_OF_KEYS: 2,
	SCRIPT: `
	local keyMeasurementResults = KEYS[1]
	local keyMeasurementAwaiting = KEYS[2]
	local rawOutputKey = ARGV[1]
	local rawOutputValue = ARGV[2]
	local rawHeadersKey = ARGV[3]
	local rawHeadersValue = ARGV[4]
	local rawBodyKey = ARGV[5]
	local rawBodyValue = ARGV[6]
	local date = ARGV[7]

	local probesAwaiting = redis.call('GET', keyMeasurementAwaiting)
	if not probesAwaiting then
		return
	end

	redis.call('JSON.STRAPPEND', keyMeasurementResults, rawOutputKey, rawOutputValue)

	if rawHeadersValue ~= 'nil' then
		redis.call('JSON.STRAPPEND', keyMeasurementResults, rawHeadersKey, rawHeadersValue)
	end

	if rawBodyValue ~= 'nil' then
		redis.call('JSON.STRAPPEND', keyMeasurementResults, rawBodyKey, rawBodyValue)
	end

	redis.call('JSON.SET', keyMeasurementResults, '$.updatedAt', date)
	`,
	transformArguments (measurementId, testId, progress) {
		return [
			// keys
			`gp:m:{${measurementId}}:results`,
			`gp:m:{${measurementId}}:probes_awaiting`,
			// values
			`$.results[${testId}].result.rawOutput`,
			JSON.stringify(progress.rawOutput),
			`$.results[${testId}].result.rawHeaders`,
			'rawHeaders' in progress ? JSON.stringify(progress.rawHeaders) : 'nil',
			`$.results[${testId}].result.rawBody`,
			'rawBody' in progress ? JSON.stringify(progress.rawBody) : 'nil',
			`"${new Date().toISOString()}"`,
		];
	},
	transformReply () {
		return null;
	},
});

const recordResult: RecordResultScript = defineScript({
	FIRST_KEY_INDEX: 0, // Needed in clusters: https://github.com/redis/node-redis/issues/2521
	NUMBER_OF_KEYS: 2,
	SCRIPT: `
	local keyMeasurementResults = KEYS[1]
	local keyMeasurementAwaiting = KEYS[2]
	local testId = ARGV[1]
	local data = ARGV[2]
	local date = ARGV[3]

	local probesAwaiting = redis.call('GET', keyMeasurementAwaiting)
	if not probesAwaiting then
		return
	end

	probesAwaiting = redis.call('DECR', keyMeasurementAwaiting)
	redis.call('JSON.SET', keyMeasurementResults, '$.results['..testId..'].result', data)
	redis.call('JSON.SET', keyMeasurementResults, '$.updatedAt', date)

	if probesAwaiting ~= 0 then
		return 0
	end

	return 1
	`,
	transformArguments (measurementId, testId, data) {
		return [
			// keys
			`gp:m:{${measurementId}}:results`,
			`gp:m:{${measurementId}}:probes_awaiting`,
			// values
			testId,
			JSON.stringify(data),
			`"${new Date().toISOString()}"`,
		];
	},
	transformReply (reply) {
		return Boolean(reply);
	},
});

const markFinished: MarkFinishedScript = defineScript({
	FIRST_KEY_INDEX: 0, // Needed in clusters: https://github.com/redis/node-redis/issues/2521
	NUMBER_OF_KEYS: 2,
	SCRIPT: `
	local keyMeasurementResults = KEYS[1]
	local keyMeasurementAwaiting = KEYS[2]

	redis.call('DEL', keyMeasurementAwaiting)
	redis.call('JSON.SET', keyMeasurementResults, '$.status', '"finished"')

	return redis.call('JSON.GET', keyMeasurementResults)
	`,
	transformArguments (measurementId) {
		return [
			// keys
			`gp:m:{${measurementId}}:results`,
			`gp:m:{${measurementId}}:probes_awaiting`,
		];
	},
	transformReply (reply) {
		return JSON.parse(reply) as MeasurementRecord | null;
	},
});

export const scripts: RedisScripts = { recordProgress, recordProgressAppend, recordResult, markFinished };
