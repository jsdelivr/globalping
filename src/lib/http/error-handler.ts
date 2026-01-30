import { ParameterizedContext } from 'koa';
import { scopedLogger } from '../logger.js';

const logger = scopedLogger('error-handler-http');

export const errorHandler = (error: Error & { code?: string }, ctx: ParameterizedContext) => {
	const ignore = [ 'ECONNABORTED', 'ECONNRESET', 'EPIPE', 'HPE_INVALID_EOF_STATE' ];

	if (error?.code && ignore.includes(error.code)) {
		return;
	}

	logger.error('Koa server error:', error, { ctx });
};
