import type { Socket } from 'socket.io';
import type { ServerSocket } from '../server.js';

import getProbeIp from '../../get-probe-ip.js';
import { scopedLogger } from '../../logger.js';

const logger = scopedLogger('ws:error');

type NextConnectArgument = (
	socket: Socket,
) => Promise<void>;

type NextMwArgument = (
	socket: Socket,
	next: () => void
) => Promise<void>;

type NextArgument = NextConnectArgument | NextMwArgument;

const isError = (error: unknown): error is Error => Boolean(error as Error['message']);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const errorHandler = (next: NextArgument) => (socket: ServerSocket, mwNext?: (error?: any) => void) => {
	next(socket, mwNext!).catch((error) => { // eslint-disable-line @typescript-eslint/no-non-null-assertion
		const clientIp = getProbeIp(socket) ?? '';
		const reason = isError(error) ? error.message : 'unknown';

		logger.info(`Disconnecting client ${socket.id} for (${reason}) [${clientIp}]`);
		logger.debug('Details:', error);

		if (mwNext) {
			mwNext(error);
		}

		socket.disconnect();
	});
};
