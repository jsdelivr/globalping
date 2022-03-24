import type {Socket} from 'socket.io';
import type {ExtendedError} from 'socket.io/dist/namespace.js';
import {WsError} from '../ws-error.js';
import {buildProbe} from '../../../probe/builder.js';
import {scopedLogger} from '../../logger.js';

const logger = scopedLogger('ws');

export const probeMetadata = async (socket: Socket, next: (error?: ExtendedError) => void) => {
	try {
		socket.data['probe'] = await buildProbe(socket);
		next();
	} catch (error: unknown) {
		const nError = new WsError((error as Error).message, {
			socketId: socket.id,
			cause: error,
		});

		logger.warn('failed to collect probe metadata');
		next(nError);
		throw nError;
	}
};
