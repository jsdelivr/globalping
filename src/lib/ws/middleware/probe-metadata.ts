import type { ServerSocket } from '../server.js';
import { WsError } from '../ws-error.js';
import { buildProbe } from '../../../probe/builder.js';
import { ProbeError } from '../../probe-error.js';
import { errorHandler } from '../helper/error-handler.js';
import { scopedLogger } from '../../logger.js';
import getProbeIp from '../../get-probe-ip.js';

const logger = scopedLogger('probe-metadata');

export const probeMetadata = errorHandler(async (socket: ServerSocket, next: (error?: Error) => void) => {
	const clientIp = getProbeIp(socket);

	try {
		socket.data.probe = await buildProbe(socket);
		next();
	} catch (error: unknown) {
		let message = 'failed to collect probe metadata';

		if (error instanceof ProbeError) {
			message = error.message;
			logger.warn(message, error);
		} else {
			logger.error(message, error);
		}

		throw new WsError(message, {
			ipAddress: clientIp ?? '',
		});
	}
});
