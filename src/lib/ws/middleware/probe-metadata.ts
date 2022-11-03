import type {Socket} from 'socket.io';
import type {ExtendedError} from 'socket.io/dist/namespace.js';
import {WsError} from '../ws-error.js';
import {buildProbe} from '../../../probe/builder.js';
import {InternalError} from '../../internal-error.js';
import {errorHandler} from '../helper/error-handler.js';
import {scopedLogger} from '../../logger.js';
import getProbeIp from '../../get-probe-ip.js';

const logger = scopedLogger('probe-metadata');

export const probeMetadata = errorHandler(async (socket: Socket, next: (error?: ExtendedError) => void) => {
	const clientIp = getProbeIp(socket.request);

	try {
		socket.data['probe'] = await buildProbe(socket);
		next();
	} catch (error: unknown) {
		logger.error(error);
		let message = 'failed to collect probe metadata';

		if (error instanceof InternalError && error?.expose) {
			message = error.message;
		}

		throw new WsError(message, {
			socketId: socket.id,
			ipAddress: clientIp!,
		});
	}
});
