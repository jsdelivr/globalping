import * as process from 'node:process';
import * as winston from 'winston';

const logger = winston.createLogger({
	level: process.env['LOG_LEVEL'] ?? 'debug',
	format: winston.format.combine(
		winston.format.timestamp({format: 'YYYY-MM-DD HH:mm:ss'}),
		winston.format.printf(info => `[${info['timestamp'] as string}] [${info.level.toUpperCase()}] [${process.pid}] [${info['scope'] as string}] ${info.message}`),
	),
	transports: [
		new winston.transports.Console(),
	],
});

export const scopedLogger = (scope: string): winston.Logger => logger.child({scope});
