import process from 'node:process';
import type { Server as SocketServer } from 'socket.io';
import newrelic from 'newrelic';

import { getWsServer, PROBES_NAMESPACE } from './ws/server.js';
import { scopedLogger } from './logger.js';
import { getMeasurementRedisClient, type RedisClient } from './redis/measurement-client.js';

const logger = scopedLogger('metrics');

export class MetricsAgent {
	private interval: NodeJS.Timeout | undefined;

	constructor (
		private readonly io: SocketServer,
		private readonly redis: RedisClient,
	) {}

	run (): void {
		this.interval = setInterval(this.intervalHandler.bind(this), 60 * 1000);
	}

	stop (): void {
		if (this.interval) {
			clearInterval(this.interval);
		}
	}

	recordMeasurementTime (type: string, time: number): void {
		newrelic.recordMetric(`measurement_time_${type}`, time);
	}

	recordMeasurement (type: string): void {
		newrelic.incrementMetric(`measurement_count_${type}`, 1);
		newrelic.incrementMetric('measurement_count_total', 1);
	}

	recordDisconnect (type: string): void {
		newrelic.incrementMetric(`probe_disconnect_${type.replaceAll(' ', '_')}`, 1);
	}

	private intervalHandler (): void {
		Promise.all([
			this.updateProbeCount(),
			this.updateMeasurementCount(),
		]).catch(error => logger.error(error));
	}

	private async updateProbeCount (): Promise<void> {
		const socketList = await this.io.of(PROBES_NAMESPACE).local.fetchSockets();
		newrelic.recordMetric(`probe_count_${process.pid}`, socketList.length);
	}

	private async updateMeasurementCount (): Promise<void> {
		const [ dbSize, awaitingSize ] = await Promise.all([
			this.redis.dbSize(),
			this.redis.hLen('gp:in-progress'),
		]);

		// running measurements use 3 keys
		// finished measurements use 2 keys
		// 1 global key tracks the in-progress measurements
		newrelic.recordMetric('measurement_record_count', Math.round((dbSize - awaitingSize - 1) / 2));
	}
}

let agent: MetricsAgent;

export const getMetricsAgent = () => {
	if (!agent) {
		agent = new MetricsAgent(getWsServer(), getMeasurementRedisClient());
	}

	return agent;
};
