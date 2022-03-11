import type {Probe} from '../../probe/store.js';
import {scopedLogger} from '../logger.js';
import {buildProbe} from '../../probe/builder.js';
import {probeStore} from '../../probe/store-factory.js';
import {handleMeasurementAck} from '../../measurement/handler/ack.js';
import {handleMeasurementResult} from '../../measurement/handler/result.js';
import {handleMeasurementProgress} from '../../measurement/handler/progress.js';
import {getWsServer} from './server.js';

const io = getWsServer();
const logger = scopedLogger('gateway');

io.of('/probes').on('connect', async socket => {
	let probe: Probe;

	try {
		probe = await buildProbe(socket);
		await probeStore.add(probe);
	} catch (error: unknown) {
		logger.error('probe connection failed', error);
		socket.disconnect();
		return;
	}

	socket.data = probe;
	logger.info(`ws client ${socket.id} connected from ${probe.country}`);

	socket.conn.on('heartbeat', async () => probeStore.markAlive(socket.id));

	socket.on('disconnect', () => {
		probeStore.delete(probe).catch(error => {
			logger.error('failed to delete probe from the store', error);
		});
	});

	// Handlers
	socket.on('probe:measurement:ack', handleMeasurementAck(probe));
	socket.on('probe:measurement:progress', handleMeasurementProgress);
	socket.on('probe:measurement:result', handleMeasurementResult);
});

