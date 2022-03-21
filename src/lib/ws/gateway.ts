import {scopedLogger} from '../logger.js';
import {handleMeasurementAck} from '../../measurement/handler/ack.js';
import {handleMeasurementResult} from '../../measurement/handler/result.js';
import {handleMeasurementProgress} from '../../measurement/handler/progress.js';
import {getWsServer, PROBES_NAMESPACE} from './server.js';
import {probeMetadata} from './middleware/probe-metadata.js';
import {verifyIpLimit} from './helper/probe-ip-limit.js';

const io = getWsServer();
const logger = scopedLogger('gateway');

io
	.of(PROBES_NAMESPACE)
	.use(probeMetadata)
	.on('connect', async socket => {
		const {probe} = socket.data;

		if (!probe) {
			logger.error('socket metadata missing', socket);
			socket.disconnect();
			return;
		}

		const isLimitReached = await verifyIpLimit(socket);
		if (isLimitReached) {
			return;
		}

		logger.info(`ws client ${socket.id} connected from ${probe.location.country}`);

		// Handlers
		socket.on('probe:measurement:ack', handleMeasurementAck(probe));
		socket.on('probe:measurement:progress', handleMeasurementProgress);
		socket.on('probe:measurement:result', handleMeasurementResult);
	});

