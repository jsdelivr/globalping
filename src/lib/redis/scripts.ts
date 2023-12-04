import { defineScript } from 'redis';
import type { MeasurementRecord, MeasurementResultMessage } from '../../measurement/types.js';

type CountScript = {
	NUMBER_OF_KEYS: number;
	SCRIPT: string;
	transformArguments (key: string): string[];
	transformReply (reply: number): number;
} & {
	SHA1: string;
};

export type RecordResultScript = {
	NUMBER_OF_KEYS: number;
	SCRIPT: string;
	transformArguments (measurementId: string, testId: string, data: MeasurementResultMessage['result']): string[];
	transformReply (reply: string): MeasurementRecord | null;
} & {
	SHA1: string;
};

export type MarkFinishedScript = {
	NUMBER_OF_KEYS: number;
	SCRIPT: string;
	transformArguments (measurementId: string): string[];
	transformReply (): null;
} & {
	SHA1: string;
};

export type RedisScripts = {
	count: CountScript;
	recordResult: RecordResultScript;
	markFinished: MarkFinishedScript;
};

export const count: CountScript = defineScript({
	NUMBER_OF_KEYS: 1,
	SCRIPT: `
	local cursor = 0
	local count = 0
	repeat
		local result = redis.call('SCAN', cursor, 'MATCH', KEYS[1], 'COUNT', 1000)
		cursor = tonumber(result[1])
		local keys = result[2]
		count = count + #keys
	until cursor == 0
	return count
	`,
	transformArguments (key: string) {
		return [ key ];
	},
	transformReply (reply: number) {
		return reply;
	},
});

export const recordResult: RecordResultScript = defineScript({
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

	redis.call('HDEL', 'gp:in-progress', measurementId)
	redis.call('DEL', awaitingKey)
	redis.call('JSON.SET', key, '$.status', '"finished"')

	return redis.call('JSON.GET', key)
	`,
	transformArguments (measurementId, testId, data) {
		return [ measurementId, testId, JSON.stringify(data), `"${new Date().toISOString()}"` ];
	},
	transformReply (reply) {
		return JSON.parse(reply) as MeasurementRecord | null;
	},
});

export const markFinished: MarkFinishedScript = defineScript({
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
