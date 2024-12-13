import { Context } from 'koa';
import { scopedLogger } from '../logger.js';

const logger = scopedLogger('error-handler-http');

export const errorHandler = (error: Error & {code?: string}, ctx: Context) => {
	const ignore = [ 'ECONNABORTED', 'ECONNRESET', 'EPIPE' ];

	if (error?.code && ignore.includes(error.code)) {
		return;
	}

	logger.error('Koa server error:', error, { ctx });
};
