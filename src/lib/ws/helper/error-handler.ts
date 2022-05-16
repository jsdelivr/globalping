import type {Socket} from 'socket.io';
import requestIp from 'request-ip';
import {scopedLogger} from '../../logger.js';
import {WsError} from '../ws-error.js';

const logger = scopedLogger('ws:error');

type NextConnectArgument = (
	socket: Socket,
) => Promise<void>;

type NextMwArgument = (
	socket: Socket,
	next: () => void
) => Promise<void>;

type NextArgument = NextConnectArgument | NextMwArgument;

const isError = (error: unknown): error is Error => Boolean((error as Error).message);

export const errorHandler = (next: NextArgument) => async (socket: Socket, mwNext?: (error?: any) => void | undefined) => {
	try {
		await next(socket, mwNext!);
	} catch (error: unknown) {
		const clientIp = requestIp.getClientIp(socket.request) ?? '';
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
