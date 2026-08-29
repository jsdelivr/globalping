import Joi from 'joi';
import { scopedLogger } from '../../logger.js';
import { ProbeValidatorError } from '../../probe-validator.js';
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
				client: { id: socket.id, ip: clientIp, version: probe.version },
				message: 'unknown',
				args,
			};

			if (isError(error)) {
				metadata['message'] = error.message;
			}

			if (Joi.isError(error)) {
				metadata['details'] = error.details;
				logger.warn(`Event "${event}" failed to handle`, metadata);
				return;
			}

			if (error instanceof ProbeValidatorError) {
				logger.warn(`Event "${event}" failed to handle`, metadata);
				return;
			}

			logger.error(`Event "${event}" failed to handle`, error, metadata);
		}
	});
};

export const subscribeWithAckHandler = (socket: ServerSocket, event: string, method: HandlerMethod) => {
	subscribeWithHandler(socket, event, async (...args) => {
		const lastArg: unknown = args.at(-1);
		const callback = typeof lastArg === 'function' ? lastArg as (response?: unknown) => void : undefined;
		const handlerArgs = callback ? args.slice(0, -1) : args;
		let acknowledged = false;

		const wrappedCallback = callback ? (response?: unknown) => {
			acknowledged = true;
			callback(response);
		} : undefined;

		try {
			await method(...handlerArgs, wrappedCallback as never);

			if (wrappedCallback && !acknowledged) {
				throw new Error(`Ack handler for event "${event}" resolved without acknowledging.`);
			}
		} finally {
			if (wrappedCallback && !acknowledged) {
				wrappedCallback();
			}
		}
	});
};
