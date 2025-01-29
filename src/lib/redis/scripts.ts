import { defineScript } from 'redis';
import type { HttpProgress, MeasurementRecord, MeasurementResultMessage, TestProgress } from '../../measurement/types.js';

type RecordProgressScript = {
	NUMBER_OF_KEYS: number;
	SCRIPT: string;
	transformArguments (measurementId: string, testId: string, keyToValue: TestProgress | HttpProgress): string[];
	transformReply (): null;
} & {
	SHA1: string;
};

type RecordProgressAppendScript = {
	NUMBER_OF_KEYS: number;
	SCRIPT: string;
	transformArguments (measurementId: string, testId: string, keyToValue: TestProgress | HttpProgress): string[];
	transformReply (): null;
} & {
	SHA1: string;
};

type RecordResultScript = {
	NUMBER_OF_KEYS: number;
	SCRIPT: string;
	transformArguments (measurementId: string, testId: string, data: MeasurementResultMessage['result']): string[];
	transformReply (reply: string): MeasurementRecord | null;
} & {
	SHA1: string;
};

type MarkFinishedScript = {
	NUMBER_OF_KEYS: number;
	SCRIPT: string;
	transformArguments (measurementId: string): string[];
	transformReply (): null;
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
	local testId = ARGV[1]
	local keyToValueJson = ARGV[2]
	local date = ARGV[3]

	local probesAwaiting = redis.call('GET', keyMeasurementAwaiting)
	if not probesAwaiting then
		return
	end

	local keyToValue = cjson.decode(keyToValueJson)

	for key, value in pairs(keyToValue) do
		redis.call('JSON.SET', keyMeasurementResults, key, value)
	end

	redis.call('JSON.SET', keyMeasurementResults, '$.updatedAt', date)
	`,
	transformArguments (measurementId, testId, keyToValue) {
		return [
			// keys
			`gp:m:{${measurementId}}:results`,
			`gp:m:{${measurementId}}:probes_awaiting`,
			// values
			testId,
			JSON.stringify(Object.fromEntries(Object.entries(keyToValue).map(([ key, value ]) => [ `$.results[${testId}].result.${key}`, JSON.stringify(value) ]))),
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
	local testId = ARGV[1]
	local keyToValueJson = ARGV[2]
	local date = ARGV[3]

	local probesAwaiting = redis.call('GET', keyMeasurementAwaiting)
	if not probesAwaiting then
		return
	end

	local keyToValue = cjson.decode(keyToValueJson)

	for key, value in pairs(keyToValue) do
		redis.call('JSON.STRAPPEND', keyMeasurementResults, key, value)
	end

	redis.call('JSON.SET', keyMeasurementResults, '$.updatedAt', date)
	`,
	transformArguments (measurementId, testId, keyToValue) {
		return [
			// keys
			`gp:m:{${measurementId}}:results`,
			`gp:m:{${measurementId}}:probes_awaiting`,
			// values
			testId,
			JSON.stringify(Object.fromEntries(Object.entries(keyToValue).map(([ key, value ]) => [ `$.results[${testId}].result.${key}`, JSON.stringify(value) ]))),
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
		return
	end

	return redis.call('JSON.GET', keyMeasurementResults)
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
		return JSON.parse(reply) as MeasurementRecord | null;
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
	`,
	transformArguments (measurementId) {
		return [
			// keys
			`gp:m:{${measurementId}}:results`,
			`gp:m:{${measurementId}}:probes_awaiting`,
		];
	},
	transformReply () {
		return null;
	},
});

export const scripts: RedisScripts = { recordProgress, recordProgressAppend, recordResult, markFinished };
