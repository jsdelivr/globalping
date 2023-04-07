import newrelic from 'newrelic';
import { scopedLogger } from '../logger.js';

const logger = scopedLogger('error-handler-http');

export const errorHandler = (error: Error & {code?: string}) => {
	const ignore = [ 'ECONNABORTED', 'ECONNRESET', 'EPIPE' ];

	if (error?.code && ignore.includes(error.code)) {
		return;
	}

	if (error instanceof Error) {
		newrelic.noticeError(error);
	}

	logger.error(error);
};
