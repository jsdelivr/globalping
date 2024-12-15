import type { ServerSocket } from '../server.js';

import { scopedLogger } from '../../logger.js';

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
			const reason = isError(error) ? error.message : 'unknown';

			logger.info(`Event "${event}" failed to handle for (${reason})`, { client: { id: socket.id, ip: clientIp } });
			logger.debug(`Details:`, error);
		}
	});
};
