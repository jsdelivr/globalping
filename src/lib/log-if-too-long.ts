import { scopedLogger } from './logger.js';

const logger = scopedLogger('log-if-too-long');

export const logIfTooLong = async <T>(promise: Promise<T>, name: string, timeoutMs = 5000): Promise<T> => {
	const startTime = Date.now();
	let isTooLong = false;

	const timer = setTimeout(() => {
		isTooLong = true;
		logger.warn(`Function "${name}" is taking longer than ${timeoutMs}ms`);
	}, timeoutMs);

	try {
		const result = await promise;

		if (isTooLong) {
			logger.info(`Function "${name}" completed successfully in ${Date.now() - startTime}ms.`);
		}

		return result;
	} finally {
		clearTimeout(timer);
	}
};
