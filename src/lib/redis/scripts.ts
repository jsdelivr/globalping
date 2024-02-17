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
	NUMBER_OF_KEYS: 4,
	SCRIPT: `
	local measurementId = KEYS[1]
	local testId = KEYS[2]
	local data = KEYS[3]
	local date = KEYS[4]
	local key = 'gp:measurement:'..measurementId
	local awaitingKey = key..':probes_awaiting'

	local probesAwaiting = redis.call('GET', awaitingKey)
	if not probesAwaiting then
		return
	end

	probesAwaiting = redis.call('DECR', awaitingKey)
	redis.call('JSON.SET', key, '$.results['..testId..'].result', data)
	redis.call('JSON.SET', key, '$.updatedAt', date)

	if probesAwaiting ~= 0 then
		return
	end

	return redis.call('JSON.GET', key)
	`,
	transformArguments (measurementId, testId, data) {
		return [ measurementId, testId, JSON.stringify(data), `"${new Date().toISOString()}"` ];
	},
	transformReply (reply) {
		return JSON.parse(reply) as MeasurementRecord | null;
	},
});

const markFinished: MarkFinishedScript = defineScript({
	NUMBER_OF_KEYS: 1,
	SCRIPT: `
	local measurementId = KEYS[1]
	local key = 'gp:measurement:'..measurementId
	local awaitingKey = key..':probes_awaiting'

	redis.call('HDEL', 'gp:in-progress', measurementId)
	redis.call('DEL', awaitingKey)
	redis.call('JSON.SET', key, '$.status', '"finished"')
	`,
	transformArguments (measurementId) {
		return [ measurementId ];
	},
	transformReply () {
		return null;
	},
});

export const scripts: RedisScripts = { recordResult, markFinished };
