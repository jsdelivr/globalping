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
			const metadata: Record<string, unknown> = {
				client: { id: socket.id, ip: clientIp },
				details: 'unknown',
			};

			if (isError(error)) {
				metadata['details'] = error.message;
			}

			if (Joi.isError(error)) {
				metadata['details'] = formatJoiError(error);
				metadata['validationInput'] = error._original;
			}

			logger.info(`Event "${event}" failed to handle`, metadata);

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
