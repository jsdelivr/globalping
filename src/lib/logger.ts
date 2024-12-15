import process from 'node:process';
import apmAgent from 'elastic-apm-node';
import ElasticWriter from 'h-logger2-elastic';
import { ConsoleWriter, Logger } from 'h-logger2';
import { Client as ElasticSearch } from '@elastic/elasticsearch';
// eslint-disable-next-line n/no-missing-import
import type { LogLevelValue } from 'h-logger2/src/types.js';

let esClient: ElasticSearch | undefined;

// istanbul ignore next
if (process.env['ELASTIC_SEARCH_URL']) {
	esClient = new ElasticSearch({
		node: process.env['ELASTIC_SEARCH_URL'],
	});
}

const loggerOptions = {
	inspectOptions: { breakLength: 120 },
};

const logger = new Logger(
	'globalping-api',
	esClient ? [
		new ConsoleWriter(Number(process.env['LOG_LEVEL']) as LogLevelValue || Logger.levels.info, loggerOptions),
		new ElasticWriter(Number(process.env['LOG_LEVEL']) as LogLevelValue || Logger.levels.info, { esClient, apmClient: apmAgent }),
	] : [
		new ConsoleWriter(Number(process.env['LOG_LEVEL']) as LogLevelValue || Logger.levels.trace, loggerOptions),
	],
);

export const scopedLogger = (scope: string, parent: Logger = logger): Logger => parent.scope(scope);

export const scopedLoggerWithPrefix = (scope: string, prefix: string, parent: Logger = logger): Logger => new Proxy(parent.scope(scope), {
	get (target, prop: keyof Logger) {
		if (prop === 'log') {
			return (level: LogLevelValue, message: string, error?: never, context?: never) => {
				return target.log(level, `${prefix} ${message}`, error, context);
			};
		}

		return target[prop];
	},
});
