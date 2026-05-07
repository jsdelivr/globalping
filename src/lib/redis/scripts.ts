import { defineScript, type CommandParser } from 'redis';
import type { HttpProgress, MeasurementResultMessage, TestProgress } from '../../measurement/types.js';

const pushMeasurementKeys = (parser: CommandParser, measurementId: string): void => {
	parser.pushKey(`gp:m:{${measurementId}}:results`);
	parser.pushKey(`gp:m:{${measurementId}}:probes_awaiting`);
};

const pushProgressArguments = (parser: CommandParser, testId: string, progress: TestProgress | HttpProgress): void => {
	parser.push(
		`$.results[${testId}].result.rawOutput`,
		JSON.stringify(progress.rawOutput),
		`$.results[${testId}].result.rawHeaders`,
		'rawHeaders' in progress ? JSON.stringify(progress.rawHeaders) : 'nil',
		`$.results[${testId}].result.rawBody`,
		'rawBody' in progress ? JSON.stringify(progress.rawBody) : 'nil',
		`"${new Date().toISOString()}"`,
	);
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
		pushProgressArguments(parser, testId, progress);
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
		pushProgressArguments(parser, testId, progress);
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
	transformReply (reply: number) {
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
	redis.call('COMPRESSED.JSON.COMPRESS', keyMeasurementResults)

	return redis.call('COMPRESSED.JSON.GET', keyMeasurementResults)
	`,
	parseCommand (parser: CommandParser, measurementId: string) {
		pushMeasurementKeys(parser, measurementId);
	},
	transformReply (reply: Buffer | null) {
		return reply;
	},
});

const markFinishedByTimeout = defineScript({
	NUMBER_OF_KEYS: 2,
	SCRIPT: `
	local keyMeasurementResults = KEYS[1]
	local keyMeasurementAwaiting = KEYS[2]
	local date = ARGV[1]
	local timeoutMessage = ARGV[2]

	local measurementJson = redis.pcall('JSON.GET', keyMeasurementResults, '$')
	if measurementJson.err or not measurementJson then
		return
	end

	local measurement = cjson.decode(measurementJson)[1]
	redis.call('DEL', keyMeasurementAwaiting)

	if measurement.status ~= 'in-progress' then
		return
	end

	redis.call('JSON.SET', keyMeasurementResults, '$.status', '"finished"')
	redis.call('JSON.SET', keyMeasurementResults, '$.updatedAt', '"' .. date .. '"')

	for index, resultObject in ipairs(measurement.results) do
		if resultObject.result.status == 'in-progress' then
			redis.call('JSON.SET', keyMeasurementResults, '$.results[' .. (index - 1) .. '].result.status', '"failed"')
			redis.call('JSON.SET', keyMeasurementResults, '$.results[' .. (index - 1) .. '].result.rawOutput', cjson.encode((resultObject.result.rawOutput or '') .. timeoutMessage))
		end
	end

	redis.call('COMPRESSED.JSON.COMPRESS', keyMeasurementResults)

	return redis.call('COMPRESSED.JSON.GET', keyMeasurementResults)
	`,
	parseCommand (parser: CommandParser, measurementId: string) {
		pushMeasurementKeys(parser, measurementId);

		parser.push(
			new Date().toISOString(),
			'\n\nThe measurement timed out.',
		);
	},
	transformReply (reply: Buffer | null) {
		return reply;
	},
});

export const scripts = { recordProgress, recordProgressAppend, recordResult, markFinished, markFinishedByTimeout };
export type RedisScripts = typeof scripts;
