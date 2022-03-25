import type {Socket} from 'socket.io';
import type {ExtendedError} from 'socket.io/dist/namespace.js';
import {WsError} from '../ws-error.js';
import {buildProbe} from '../../../probe/builder.js';
import {scopedLogger} from '../../logger.js';
import {InternalError} from '../../internal-error.js';

const logger = scopedLogger('ws');

export const probeMetadata = async (socket: Socket, next: (error?: ExtendedError) => void) => {
	try {
		socket.data['probe'] = await buildProbe(socket);
		next();
	} catch (error: unknown) {
		let message = 'failed to collect probe metadata';

		if (error instanceof InternalError && error?.expose) {
			message = error.message;
		}

		logger.warn(message);
		const nError = new WsError(message, {socketId: socket.id});

		next(nError);
		throw nError;
	}
};
