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
		return
	end

	redis.call('DEL', keyMeasurementAwaiting)
	redis.call('JSON.SET', keyMeasurementResults, '$.status', '"finished"')
	redis.call('COMPRESSED.JSON.COMPRESS', keyMeasurementResults)

	return redis.call('COMPRESSED.JSON.GET', keyMeasurementResults)
	`,
	parseCommand (parser: CommandParser, measurementId: string, testId: string, data: MeasurementResultMessage['result']) {
		pushMeasurementKeys(parser, measurementId);

		parser.push(
			testId,
			JSON.stringify(data),
			`"${new Date().toISOString()}"`,
		);
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
	local timedOutTests = 0

	local measurementJson = redis.pcall('JSON.GET', keyMeasurementResults, '$')
	if not measurementJson or measurementJson.err then
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
			timedOutTests = timedOutTests + 1
			local rawOutput = resultObject.result.rawOutput or ''
			redis.call('JSON.SET', keyMeasurementResults, '$.results[' .. (index - 1) .. '].result.status', '"failed"')
			redis.call('JSON.SET', keyMeasurementResults, '$.results[' .. (index - 1) .. '].result.failureSource', '"internal"')
			redis.call('JSON.SET', keyMeasurementResults, '$.results[' .. (index - 1) .. '].result.rawOutput', cjson.encode(rawOutput .. (rawOutput ~= '' and '\\n\\n' or '') .. timeoutMessage))
		end
	end

	redis.call('COMPRESSED.JSON.COMPRESS', keyMeasurementResults)

	return { redis.call('COMPRESSED.JSON.GET', keyMeasurementResults), timedOutTests }
	`,
	parseCommand (parser: CommandParser, measurementId: string) {
		pushMeasurementKeys(parser, measurementId);

		parser.push(
			new Date().toISOString(),
			'The measurement timed out.',
		);
	},
	transformReply (reply: [Buffer, number] | null) {
		if (!reply) {
			return null;
		}

		return {
			recordBuffer: reply[0],
			timedOutTests: reply[1],
		};
	},
});

const claimTimedOutMeasurements = defineScript({
	NUMBER_OF_KEYS: 1,
	SCRIPT: `
	local keyMeasurementTimeouts = KEYS[1]
	local now = ARGV[1]
	local batchSize = tonumber(ARGV[2])
	local leaseUntil = ARGV[3]

	local ids = redis.call('ZRANGEBYSCORE', keyMeasurementTimeouts, '-inf', now, 'LIMIT', 0, batchSize)

	for _, id in ipairs(ids) do
		redis.call('ZADD', keyMeasurementTimeouts, leaseUntil, id)
	end

	return ids
	`,
	parseCommand (parser: CommandParser, key: string, now: number, batchSize: number, leaseUntil: number) {
		parser.pushKey(key);

		parser.push(
			now.toString(),
			batchSize.toString(),
			leaseUntil.toString(),
		);
	},
	transformReply (reply: string[]) {
		return reply;
	},
});

const registerProbeLogScopes = defineScript({
	SCRIPT: `
	local reporterKey = KEYS[1]
	local knownScopesKey = KEYS[2]
	local activeWindow = tonumber(ARGV[1])
	local maxScopes = tonumber(ARGV[2])
	local minReporters = tonumber(ARGV[3])
	local reporterIdentity = ARGV[4]
	local now = tonumber(redis.call('TIME')[1])
	local cutoff = now - activeWindow

	redis.call('ZREMRANGEBYSCORE', reporterKey, '-inf', cutoff)

	local scores = redis.call('ZMSCORE', reporterKey, unpack(ARGV, 5))
	local newScopes = 0

	for index = 1, #scores do
		if not scores[index] then
			newScopes = newScopes + 1
		end
	end

	if redis.call('ZCARD', reporterKey) + newScopes > maxScopes then
		return 0
	end

	local zaddArguments = {}

	for index = 5, #ARGV do
		table.insert(zaddArguments, now)
		table.insert(zaddArguments, ARGV[index])
	end

	redis.call('ZADD', reporterKey, 'GT', unpack(zaddArguments))
	redis.call('EXPIRE', reporterKey, activeWindow)

	local knownScopes = redis.call('SMISMEMBER', knownScopesKey, unpack(ARGV, 5))
	local newKnownScopes = {}

	for index = 3, #KEYS do
		local scopeKey = KEYS[index]
		local scopeIndex = index - 2

		redis.call('ZADD', scopeKey, 'GT', now, reporterIdentity)
		redis.call('ZREMRANGEBYSCORE', scopeKey, '-inf', cutoff)
		redis.call('EXPIRE', scopeKey, activeWindow)

		if knownScopes[scopeIndex] == 0 and redis.call('ZCARD', scopeKey) >= minReporters then
			table.insert(newKnownScopes, ARGV[index + 2])
		end
	end

	if #newKnownScopes > 0 then
		redis.call('SADD', knownScopesKey, unpack(newKnownScopes))
	end

	return 1
	`,
	parseCommand (
		parser: CommandParser,
		reporterKey: string,
		knownScopesKey: string,
		scopeKeys: string[],
		reporterIdentity: string,
		activeWindow: number,
		maxScopes: number,
		minReporters: number,
		scopes: string[],
	) {
		parser.push((scopeKeys.length + 2).toString());
		parser.pushKey(reporterKey);
		parser.pushKey(knownScopesKey);
		scopeKeys.forEach(scopeKey => parser.pushKey(scopeKey));

		parser.push(
			activeWindow.toString(),
			maxScopes.toString(),
			minReporters.toString(),
			reporterIdentity,
			...scopes,
		);
	},
	transformReply (reply: number) {
		return reply === 1;
	},
});

const countProbeLogScopeReporters = defineScript({
	NUMBER_OF_KEYS: 2,
	SCRIPT: `
	local now = tonumber(redis.call('TIME')[1])
	local cutoff = now - tonumber(ARGV[2])

	redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', cutoff)
	local count = redis.call('ZCARD', KEYS[2])

	if count < tonumber(ARGV[3]) then
		redis.call('SREM', KEYS[1], ARGV[1])
	end

	return count
	`,
	parseCommand (parser: CommandParser, knownScopesKey: string, scopeKey: string, scope: string, activeWindow: number, minReporters: number) {
		parser.pushKey(knownScopesKey);
		parser.pushKey(scopeKey);
		parser.push(scope, activeWindow.toString(), minReporters.toString());
	},
	transformReply (reply: number) {
		return reply;
	},
});

export const scripts = {
	recordProgress,
	recordProgressAppend,
	recordResult,
	markFinishedByTimeout,
	claimTimedOutMeasurements,
	registerProbeLogScopes,
	countProbeLogScopeReporters,
};
export type RedisScripts = typeof scripts;
