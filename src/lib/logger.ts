import process from 'node:process';
import { inspect } from 'node:util';
import * as winston from 'winston';

const objectFormatter = (object: Record<string, unknown>) => {
	const objectWithoutSymbols = Object.fromEntries(Object.entries(object));
	return inspect(objectWithoutSymbols);
};

const logger = winston.createLogger({
	level: process.env['LOG_LEVEL'] ?? 'debug',
	format: winston.format.combine(
		winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
		winston.format.prettyPrint(),
		winston.format.printf((info: winston.Logform.TransformableInfo) => {
			const { timestamp, level, scope, message, stack, ...otherFields } = info; // eslint-disable-line @typescript-eslint/no-unsafe-assignment
			let result = `[${timestamp as string}] [${level.toUpperCase()}] [${process.pid}] [${scope as string}] ${message as string}`;

			if (Object.keys(otherFields).length > 0) {
				result += `\n${objectFormatter(otherFields)}`;
			}

			if (stack) {
				result += `\n${info['stack'] as string}`;
			}

			return result;
		}),
	),
	transports: [
		new winston.transports.Console(),
	],
});

export const scopedLogger = (scope: string): winston.Logger => logger.child({ scope });
