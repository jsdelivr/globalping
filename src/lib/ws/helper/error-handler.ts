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

export const errorHandler = (next: NextArgument) => async (socket: Socket, mwNext?: (error?: any) => void | undefined) => {
	try {
		await next(socket, mwNext!);
	} catch (error: unknown) {
		if (error instanceof WsError) {
			socket.emit('api:error', error.toJson());
			logger.info(`disconnecting client ${error.info.socketId} for (${error.message})`);
		}

		if (mwNext) {
			mwNext(error);
		}

		socket.disconnect();
	}
};
