import { defineScript } from 'redis';
import type { MeasurementRecord, MeasurementResultMessage } from '../../measurement/types.js';

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
	recordResult: RecordResultScript;
	markFinished: MarkFinishedScript;
};

const recordResult: RecordResultScript = defineScript({
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
			`gp:m:${measurementId}:results`,
			`gp:m:${measurementId}:probes_awaiting`,
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
	NUMBER_OF_KEYS: 3,
	SCRIPT: `
	local keyInProgress = KEYS[1]
	local keyMeasurementResults = KEYS[2]
	local keyMeasurementAwaiting = KEYS[3]
	local measurementId = ARGV[1]

	redis.call('HDEL', keyInProgress, measurementId)
	redis.call('DEL', keyMeasurementAwaiting)
	redis.call('JSON.SET', keyMeasurementResults, '$.status', '"finished"')
	`,
	transformArguments (measurementId) {
		return [
			// keys
			'gp:in-progress',
			`gp:m:${measurementId}:results`,
			`gp:m:${measurementId}:probes_awaiting`,
			// values
			measurementId,
		];
	},
	transformReply () {
		return null;
	},
});

export const scripts: RedisScripts = { recordResult, markFinished };
