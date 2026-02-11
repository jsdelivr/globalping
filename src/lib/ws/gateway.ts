import { listenMeasurementRequest } from '../../measurement/handler/request.js';
import { handleMeasurementAck } from '../../measurement/handler/ack.js';
import { handleMeasurementResult } from '../../measurement/handler/result.js';
import { handleMeasurementProgress } from '../../measurement/handler/progress.js';
import { handleStatusUpdate } from '../../probe/handler/status.js';
import { handleDnsUpdate } from '../../probe/handler/dns.js';
import { handleStatsReport } from '../../probe/handler/stats.js';
import { scopedLogger } from '../logger.js';
import { PROBES_NAMESPACE, type ServerSocket } from './server.js';
import { health } from './middleware/health.js';
import { probeMetadata } from './middleware/probe-metadata.js';
import { errorHandler } from './helper/error-handler.js';
import { subscribeWithHandler } from './helper/subscribe-handler.js';
import { handleIsIPv4SupportedUpdate, handleIsIPv6SupportedUpdate } from '../../probe/handler/ip-version.js';
import { handleNewLogs } from '../../probe/handler/logs.js';
import { handleAltIps } from '../../probe/handler/alt-ips.js';
import type { IoContext } from '../server.js';

const logger = scopedLogger('gateway');

export const initGateway = (ioContext: IoContext) => {
	const { io, probeOverride, metricsAgent, adoptionToken, probeIpLimit, measurementRunner, altIpsClient } = ioContext;

	io
		.of(PROBES_NAMESPACE)
		.use(health)
		.use(probeMetadata(probeIpLimit))
		.on('connect', errorHandler(async (socket: ServerSocket) => {
			const probe = socket.data.probe;
			const location = probeOverride.getUpdatedLocation(probe);

			adoptionToken.validate(socket).catch(err => logger.warn('Error during adoption token validation:', err));
			socket.emit('api:connect:ip', { ip: probe.ipAddress });
			socket.emit('api:connect:location', location);
			socket.emit('api:logs-transport:set', { isActive: true });
			logger.info(`WS client connected.`, { client: { id: socket.id, ip: probe.ipAddress }, location: { city: location.city, country: location.country, network: location.network } });

			// Handlers
			subscribeWithHandler(socket, 'probe:status:update', handleStatusUpdate(probe));
			subscribeWithHandler(socket, 'probe:logs', handleNewLogs(probe));
			subscribeWithHandler(socket, 'probe:alt-ips', handleAltIps(probe, altIpsClient));
			subscribeWithHandler(socket, 'probe:isIPv6Supported:update', handleIsIPv6SupportedUpdate(probe));
			subscribeWithHandler(socket, 'probe:isIPv4Supported:update', handleIsIPv4SupportedUpdate(probe));
			subscribeWithHandler(socket, 'probe:dns:update', handleDnsUpdate(probe));
			subscribeWithHandler(socket, 'probe:stats:report', handleStatsReport(probe));
			socket.onAnyOutgoing(listenMeasurementRequest(probe));
			subscribeWithHandler(socket, 'probe:measurement:ack', handleMeasurementAck(probe));
			subscribeWithHandler(socket, 'probe:measurement:progress', handleMeasurementProgress(probe, measurementRunner));
			subscribeWithHandler(socket, 'probe:measurement:result', handleMeasurementResult(probe, measurementRunner));

			socket.on('disconnect', (reason) => {
				logger.debug(`Probe disconnected. (reason: ${reason}) [${socket.id}][${probe.ipAddress}]`);

				if (reason === 'server namespace disconnect') {
					return; // Probe was disconnected by the .disconnect() call from the API, no need to record that
				}

				metricsAgent.recordDisconnect(reason);
			});
		}));
};
