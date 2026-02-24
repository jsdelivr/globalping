import type { ServerSocket } from '../server.js';
import { WsError } from '../ws-error.js';
import { buildProbe } from '../../../probe/builder.js';
import { ProbeError } from '../../probe-error.js';
import { errorHandler } from '../helper/error-handler.js';
import { scopedLogger } from '../../logger.js';
import getProbeIp from '../../get-probe-ip.js';
import type { ProbeIpLimit } from '../helper/probe-ip-limit.js';

const logger = scopedLogger('probe-metadata');

export const probeMetadata = (probeIpLimit: ProbeIpLimit) => errorHandler(async (socket: ServerSocket, next: (error?: Error) => void) => {
	const clientIp = getProbeIp(socket);

	try {
		parseHandshakeQuery(socket);
		socket.data.probe = await buildProbe(socket, probeIpLimit);
		next();
	} catch (error: unknown) {
		let message = 'failed to collect probe metadata';

		if (error instanceof ProbeError) {
			logger.warn(message, error);
			message = error.message;
		} else {
			logger.error(message, error);
		}

		throw new WsError(message, {
			ipAddress: clientIp ?? '',
		});
	}
});


const parseHandshakeQuery = (socket: ServerSocket) => {
	for (const [ key, value ] of Object.entries(socket.handshake.query)) {
		if (value === 'undefined') { socket.handshake.query[key] = undefined; }
	}
};
