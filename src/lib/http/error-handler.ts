import { ParameterizedContext } from 'koa';
import { scopedLogger } from '../logger.js';

const logger = scopedLogger('error-handler-http');

export const errorHandler = (error: Error & { code?: string }, ctx: ParameterizedContext) => {
	const ignore = [ 'ECONNABORTED', 'ECONNRESET', 'EPIPE' ];

	if (error?.code && (ignore.includes(error.code) || error.code.startsWith('HPE_'))) {
		return;
	}

	logger.error('Koa server error:', error, { ctx });
};
