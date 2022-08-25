import type {Socket} from 'socket.io';
import requestIp from 'request-ip';
import type {ExtendedError} from 'socket.io/dist/namespace.js';
import {WsError} from '../ws-error.js';
import {buildProbe} from '../../../probe/builder.js';
import {InternalError} from '../../internal-error.js';
import {errorHandler} from '../helper/error-handler.js';

export const probeMetadata = errorHandler(async (socket: Socket, next: (error?: ExtendedError) => void) => {
	const clientIp = requestIp.getClientIp(socket.request);

	try {
		socket.data['probe'] = await buildProbe(socket);
		next();
	} catch (error: unknown) {
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
