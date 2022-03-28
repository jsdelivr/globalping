import type {Socket} from 'socket.io';
import type {Probe} from '../../probe/types.js';
import {handleMeasurementAck} from '../../measurement/handler/ack.js';
import {handleMeasurementResult} from '../../measurement/handler/result.js';
import {handleMeasurementProgress} from '../../measurement/handler/progress.js';
import {scopedLogger} from '../logger.js';
import {getWsServer, PROBES_NAMESPACE} from './server.js';
import {probeMetadata} from './middleware/probe-metadata.js';
import {verifyIpLimit} from './helper/probe-ip-limit.js';
import {errorHandler} from './helper/error-handler.js';

const io = getWsServer();
const logger = scopedLogger('gateway');

io
	.of(PROBES_NAMESPACE)
	.use(probeMetadata)
	.on('connect', errorHandler(async (socket: Socket) => {
		await verifyIpLimit(socket);

		const probe = socket.data['probe'] as Probe;
		socket.emit('api:connect:location', probe.location);
		logger.info(`ws client ${socket.id} connected from ${probe.location.country}`);

		// Handlers
		socket.on('probe:measurement:ack', handleMeasurementAck(probe));
		socket.on('probe:measurement:progress', handleMeasurementProgress);
		socket.on('probe:measurement:result', handleMeasurementResult);
	}));
