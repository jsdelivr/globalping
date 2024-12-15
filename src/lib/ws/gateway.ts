import { getMetricsAgent } from '../metrics.js';
import { handleMeasurementAck } from '../../measurement/handler/ack.js';
import { handleMeasurementResult } from '../../measurement/handler/result.js';
import { handleMeasurementProgress } from '../../measurement/handler/progress.js';
import { handleStatusUpdate } from '../../probe/handler/status.js';
import { handleDnsUpdate } from '../../probe/handler/dns.js';
import { handleStatsReport } from '../../probe/handler/stats.js';
import { scopedLogger } from '../logger.js';
import { probeOverride, getWsServer, PROBES_NAMESPACE, ServerSocket, adoptedProbes } from './server.js';
import { probeMetadata } from './middleware/probe-metadata.js';
import { errorHandler } from './helper/error-handler.js';
import { subscribeWithHandler } from './helper/subscribe-handler.js';
import { handleIsIPv4SupportedUpdate, handleIsIPv6SupportedUpdate } from '../../probe/handler/ip-version.js';
import { getAltIpsClient } from '../alt-ips.js';

const io = getWsServer();
const logger = scopedLogger('gateway');
const metricsAgent = getMetricsAgent();

io
	.of(PROBES_NAMESPACE)
	.use(probeMetadata)
	.on('connect', errorHandler(async (socket: ServerSocket) => {
		const probe = socket.data.probe;
		const location = probeOverride.getUpdatedLocation(probe);
		const isAdopted = !!adoptedProbes.getByIp(probe.ipAddress);

		socket.emit('api:connect:alt-ips-token', {
			token: await getAltIpsClient().generateToken(socket),
			socketId: socket.id,
			ip: probe.ipAddress,
		});

		socket.emit('api:connect:location', location);
		socket.emit('api:connect:adoption', { isAdopted });
		logger.info(`WS client connected`, { client: { id: socket.id, ip: probe.ipAddress }, location: { city: location.city, country: location.country, network: location.network } });

		// Handlers
		socket.on('probe:status:update', handleStatusUpdate(probe));
		socket.on('probe:isIPv6Supported:update', handleIsIPv6SupportedUpdate(probe));
		socket.on('probe:isIPv4Supported:update', handleIsIPv4SupportedUpdate(probe));
		socket.on('probe:dns:update', handleDnsUpdate(probe));
		socket.on('probe:stats:report', handleStatsReport(probe));
		subscribeWithHandler(socket, 'probe:measurement:ack', handleMeasurementAck(probe));
		subscribeWithHandler(socket, 'probe:measurement:progress', handleMeasurementProgress);
		subscribeWithHandler(socket, 'probe:measurement:result', handleMeasurementResult);

		socket.on('disconnect', (reason) => {
			logger.debug(`Probe disconnected. (reason: ${reason}) [${socket.id}][${probe.ipAddress}]`);

			if (reason === 'server namespace disconnect') {
				return; // Probe was disconnected by the .disconnect() call from the API, no need to record that
			}

			metricsAgent.recordDisconnect(reason);
		});
	}));
