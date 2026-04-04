import { defineScript, type CommandParser } from 'redis';
import type { HttpProgress, MeasurementRecord, MeasurementResultMessage, TestProgress } from '../../measurement/types.js';

const pushMeasurementKeys = (parser: CommandParser, measurementId: string) => {
	parser.pushKey(`gp:m:{${measurementId}}:results`);
	parser.pushKey(`gp:m:{${measurementId}}:probes_awaiting`);
};

const recordProgress = defineScript({
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
	parseCommand (parser: CommandParser, measurementId: string, testId: string, progress: TestProgress | HttpProgress) {
		pushMeasurementKeys(parser, measurementId);

		parser.push(
			`$.results[${testId}].result.rawOutput`,
			JSON.stringify(progress.rawOutput),
			`$.results[${testId}].result.rawHeaders`,
			'rawHeaders' in progress ? JSON.stringify(progress.rawHeaders) : 'nil',
			`$.results[${testId}].result.rawBody`,
			'rawBody' in progress ? JSON.stringify(progress.rawBody) : 'nil',
			`"${new Date().toISOString()}"`,
		);
	},
	transformReply () {
		return null;
	},
});

const recordProgressAppend = defineScript({
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
	parseCommand (parser: CommandParser, measurementId: string, testId: string, progress: TestProgress | HttpProgress) {
		pushMeasurementKeys(parser, measurementId);

		parser.push(
			`$.results[${testId}].result.rawOutput`,
			JSON.stringify(progress.rawOutput),
			`$.results[${testId}].result.rawHeaders`,
			'rawHeaders' in progress ? JSON.stringify(progress.rawHeaders) : 'nil',
			`$.results[${testId}].result.rawBody`,
			'rawBody' in progress ? JSON.stringify(progress.rawBody) : 'nil',
			`"${new Date().toISOString()}"`,
		);
	},
	transformReply () {
		return null;
	},
});

const recordResult = defineScript({
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
	parseCommand (parser: CommandParser, measurementId: string, testId: string, data: MeasurementResultMessage['result']) {
		pushMeasurementKeys(parser, measurementId);

		parser.push(
			testId,
			JSON.stringify(data),
			`"${new Date().toISOString()}"`,
		);
	},
	transformReply (reply) {
		return Boolean(reply);
	},
});

const markFinished = defineScript({
	NUMBER_OF_KEYS: 2,
	SCRIPT: `
	local keyMeasurementResults = KEYS[1]
	local keyMeasurementAwaiting = KEYS[2]

	redis.call('DEL', keyMeasurementAwaiting)
	redis.call('JSON.SET', keyMeasurementResults, '$.status', '"finished"')

	return redis.call('JSON.GET', keyMeasurementResults)
	`,
	parseCommand (parser: CommandParser, measurementId: string) {
		pushMeasurementKeys(parser, measurementId);
	},

	transformReply (reply: string) {
		return JSON.parse(reply) as MeasurementRecord | null;
	},
});

export type RedisScripts = {
	recordProgress: typeof recordProgress;
	recordProgressAppend: typeof recordProgressAppend;
	recordResult: typeof recordResult;
	markFinished: typeof markFinished;
};

export const scripts: RedisScripts = { recordProgress, recordProgressAppend, recordResult, markFinished };
