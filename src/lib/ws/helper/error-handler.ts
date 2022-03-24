import type {Socket} from 'socket.io';
import {scopedLogger} from '../../logger.js';
import {WsError} from '../ws-error.js';

const logger = scopedLogger('ws:error');

type NextArgument = (
	socket: Socket
) => Promise<void>;

export const errorHandler = (next: NextArgument) => async (socket: Socket) => {
	try {
		await next(socket);
	} catch (error: unknown) {
		if (error instanceof WsError) {
			const pError = error.toJson();
			socket.emit('api:error', pError);
			logger.info(`disconnecting client ${pError.info.socketId} for (${pError.message})`);
		}

		socket.disconnect();
	}
};
