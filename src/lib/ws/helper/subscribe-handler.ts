import Joi from 'joi';
import { scopedLogger } from '../../logger.js';
import type { ServerSocket } from '../server.js';

const logger = scopedLogger('ws:handler:error');
const isError = (error: unknown): error is Error => Boolean(error as Error['message']);

type HandlerMethod = (...args: never[]) => Promise<void> | void;

export const subscribeWithHandler = (socket: ServerSocket, event: string, method: HandlerMethod) => {
	socket.on(event, async (...args) => {
		try {
			await method(...args as never[]);
		} catch (error: unknown) {
			const probe = socket.data.probe;
			const clientIp = probe.ipAddress;
			let details = 'unknown';

			if (isError(error)) {
				details = error.message;
			}

			if (Joi.isError(error)) {
				details = formatJoiError(error);
			}

			logger.info(`Event "${event}" failed to handle for (${details})`, {
				client: { id: socket.id, ip: clientIp },
			});

			logger.debug(`Details:`, error);
		}
	});
};

const formatJoiError = (error: Joi.ValidationError) => {
	const messages = error.details.map(({ message, context }) => {
		let str = `${message}.`;

		if (context?.value) {
			str += `Received: "${context?.value}".`;
		}

		return str;
	});

	return messages.length ? error.message : messages.join('\n');
};
