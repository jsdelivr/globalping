import Joi from 'joi';
import { scopedLogger } from '../../logger.js';
import type { ServerSocket } from '../server.js';

const logger = scopedLogger('ws:handler:error');
const isError = (error: unknown): error is Error => Boolean(error as Error['message']);

type HandlerMethod = (...args: never[]) => Promise<void>;

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
				const messages = error.details.map(({ message, context }) => `${message}. Received: "${context?.value}"`);

				if (messages.length) {
					details = messages.join('\n');
				}
			}

			logger.info(`Event "${event}" failed to handle for (${details})`, {
				client: { id: socket.id, ip: clientIp },
			});

			logger.debug(`Details:`, error);
		}
	});
};
