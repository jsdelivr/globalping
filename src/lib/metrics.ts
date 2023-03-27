import type { Server as SocketServer } from 'socket.io';
import newrelic from 'newrelic';

import { getRedisClient, type RedisClient } from './redis/client.js';
import { getWsServer, PROBES_NAMESPACE } from './ws/server.js';
import { scopedLogger } from './logger.js';

const logger = scopedLogger('metrics');

export class MetricsAgent {
	private interval: NodeJS.Timer | undefined;

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

	private async intervalHandler (): Promise<void> {
		try {
			await this.updateProbeCount();
			await this.updateMeasurementCount();
		} catch (error) {
			logger.error(error);
		}
	}

	private async updateProbeCount (): Promise<void> {
		const socketList = await this.io.of(PROBES_NAMESPACE).local.fetchSockets();
		newrelic.recordMetric('probe_count', socketList.length);
	}

	private async updateMeasurementCount (): Promise<void> {
		let count = 0;

		for await (const _ of this.redis.scanIterator({ MATCH: 'gp:measurement:*' })) { // eslint-disable-line @typescript-eslint/no-unused-vars
			count++;
		}

		newrelic.recordMetric('measurement_record_count', count);
	}
}

let agent: MetricsAgent;

export const getMetricsAgent = () => {
	if (!agent) {
		agent = new MetricsAgent(getWsServer(), getRedisClient());
	}

	return agent;
};
