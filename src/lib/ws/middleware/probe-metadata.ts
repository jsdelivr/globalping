// eslint-disable-next-line n/no-missing-import
import type { ExtendedError } from 'socket.io/dist/namespace.js';

import type { ServerSocket } from '../server.js';
import { WsError } from '../ws-error.js';
import { buildProbe } from '../../../probe/builder.js';
import { ProbeError } from '../../probe-error.js';
import { errorHandler } from '../helper/error-handler.js';
import { scopedLogger } from '../../logger.js';
import getProbeIp from '../../get-probe-ip.js';

const logger = scopedLogger('probe-metadata');

export const probeMetadata = errorHandler(async (socket: ServerSocket, next: (error?: ExtendedError) => void) => {
	const clientIp = getProbeIp(socket);

	try {
		socket.data.probe = await buildProbe(socket);
		next();
	} catch (error: unknown) {
		logger.error(error);
		let message = 'failed to collect probe metadata';

		if (error instanceof ProbeError) {
			message = error.message;
		}

		throw new WsError(message, {
			ipAddress: clientIp ?? '',
		});
	}
});
