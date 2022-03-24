import type {Socket} from 'socket.io';
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

export const errorHandler = (next: NextArgument) => async (socket: Socket, mwNext?: () => void | undefined) => {
	try {
		await next(socket, mwNext!);
	} catch (error: unknown) {
		if (error instanceof WsError) {
			const pError = error.toJson();
			socket.emit('api:error', pError);
			logger.info(`disconnecting client ${pError.info.socketId} for (${pError.message})`);
		}

		socket.disconnect();
	}
};
