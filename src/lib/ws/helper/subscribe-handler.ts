import type { Socket } from 'socket.io';
import type { Probe } from '../../../probe/types.js';
import { scopedLogger } from '../../logger.js';

const logger = scopedLogger('ws:handler:error');
const isError = (error: unknown): error is Error => Boolean(error as Error['message']);

type HandlerMethod = (...args: never[]) => Promise<void>;

export const subscribeWithHandler = (socket: Socket, event: string, method: HandlerMethod) => {
	socket.on(event, async (...args) => {
		try {
			await method(...args as never[]);
		} catch (error: unknown) {
			const probe = socket.data['probe'] as Probe;
			const clientIp = probe.ipAddress;
			const reason = isError(error) ? error.message : 'unknown';

			logger.info(`event "${event}" failed to handle. ${socket.id} for (${reason}) [${clientIp}]`);
			logger.debug(error);
		}
	});
};
