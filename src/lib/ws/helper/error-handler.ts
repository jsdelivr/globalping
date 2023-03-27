import type { Socket } from 'socket.io';
import getProbeIp from '../../get-probe-ip.js';
import { scopedLogger } from '../../logger.js';
import { WsError } from '../ws-error.js';

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
export const errorHandler = (next: NextArgument) => async (socket: Socket, mwNext?: (error?: any) => void | undefined) => {
	try {
		await next(socket, mwNext!); // eslint-disable-line @typescript-eslint/no-non-null-assertion
	} catch (error: unknown) {
		const clientIp = getProbeIp(socket.request) ?? '';
		const reason = isError(error) ? error.message : 'unknown';

		logger.info(`disconnecting client ${socket.id} for (${reason}) [${clientIp}]`);
		logger.debug(error);

		if (error instanceof WsError) {
			socket.emit('api:error', error.toJson());
		}

		if (mwNext) {
			mwNext(error);
		}

		socket.disconnect();
	}
};
