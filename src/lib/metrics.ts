import type {Server as SocketServer} from 'socket.io';
import newrelic from 'newrelic';

import {getRedisClient, RedisClient} from './redis/client.js';
import {getWsServer, PROBES_NAMESPACE} from './ws/server.js';

export class MetricsAgent {
	private interval: NodeJS.Timer | undefined;

	constructor(
		private readonly io: SocketServer,
		private readonly redis: RedisClient,
	) {}

	run(): void {
		this.interval = setInterval(this.intervalHandler.bind(this), 60 * 1000);
	}

	stop(): void {
		if (this.interval) {
			clearInterval(this.interval);
		}
	}

	recordMeasurementTime(type: string, time: number): void {
		newrelic.recordMetric(`measurement_time_${type}`, time);
	}

	recordMeasurement(type: string): void {
		newrelic.incrementMetric(`measurement_count_${type}`, 1);
		newrelic.incrementMetric('measurement_count_total', 1);
	}

	private async intervalHandler(): Promise<void> {
		await this.updateProbeCount();
		await this.updateMeasurementCount();
	}

	private async updateProbeCount(): Promise<void> {
		const socketList = await this.io.of(PROBES_NAMESPACE).local.fetchSockets();
		newrelic.recordMetric('probe_count', socketList.length);
	}

	private async updateMeasurementCount(): Promise<void> {
		let count = 0;
		// eslint-disable-next-line @typescript-eslint/naming-convention
		for await (const _ of this.redis.scanIterator({MATCH: 'gp:measurement:*'})) {
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
