import type {Socket} from 'socket.io';
import type {ExtendedError} from 'socket.io/dist/namespace.js';
import {buildProbe} from '../../../probe/builder.js';
import {scopedLogger} from '../../logger.js';

const logger = scopedLogger('ws');

export const probeMetadata = async (socket: Socket, next: (error?: ExtendedError) => void) => {
	try {
		socket.data['probe'] = await buildProbe(socket);
		next();
	} catch {
		// Todo: add more info to log when we add probe authentication
		logger.warn('failed to collect probe metadata');
		next(new Error('failed to collect probe metadata'));
	}
};
