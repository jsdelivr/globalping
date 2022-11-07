import * as process from 'node:process';
import * as winston from 'winston';

const metaEntryToString = (data: unknown): string => typeof data === 'object' ? JSON.stringify(data) : String(data);

const logger = winston.createLogger({
	level: process.env['LOG_LEVEL'] ?? 'debug',
	format: winston.format.combine(
		winston.format.timestamp({format: 'YYYY-MM-DD HH:mm:ss'}),
		winston.format.printf(info => {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			const {timestamp, level, scope, message, ...meta} = info;
			const data = Object.keys(meta).map(k => `\n  ${k} -> ${metaEntryToString(meta[k])}`).join('');
			return `[${timestamp as string}] [${level.toUpperCase()}] [${process.pid}] [${scope as string}] ${info.message as string}${data}`;
		}),
	),
	transports: [
		new winston.transports.Console({
			silent: process.env['NODE_ENV'] === 'test',
		}),
	],
});

export const scopedLogger = (scope: string): winston.Logger => logger.child({scope});
