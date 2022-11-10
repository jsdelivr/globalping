import newrelic from 'newrelic';
import {scopedLogger} from '../logger.js';

const logger = scopedLogger('error-handler-http');

export const errorHandler = (error: unknown) => {
	if (error instanceof Error) {
		newrelic.noticeError(error);
	}

	logger.error(error);
};
