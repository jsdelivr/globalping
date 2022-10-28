// import type {Server as SocketServer} from 'socket.io';
// import type {Metrics} from '@appsignal/nodejs';
import newrelic from 'newrelic';

// import {getRedisClient, RedisClient} from './redis/client.js';
// import {getWsServer} from './ws/server.js';
// import Appsignal from './appsignal.js';

export class MetricsAgent {
	// private readonly metrics: Metrics;

	private interval: NodeJS.Timer | undefined;

	constructor(
		// private readonly io: SocketServer,
		// private readonly redis: RedisClient,
	) {
		// this.metrics = Appsignal.metrics();
	}

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
		newrelic.incrementMetric(`measurement_count_${type}`);
		newrelic.incrementMetric('measurement_count_total');
	}

	private async intervalHandler(): Promise<void> {
		await this.updateProbeCount();
		await this.updateMeasurementCount();
	}

	private async updateProbeCount(): Promise<void> {
		// const socketList = await this.io.of(PROBES_NAMESPACE).fetchSockets();
		// this.metrics.setGauge('probe.count', socketList.length, {group: 'total'});
	}

	private async updateMeasurementCount(): Promise<void> {
		// let count = 0;

		// eslint-disable-next-line @typescript-eslint/naming-convention, no-empty-pattern
		// for await ({} of this.redis.scanIterator({MATCH: 'gp:measurement:*'})) {
		// 	count++;
		// }

		// this.metrics.setGauge('measurement.record.count', count, {type: 'total'});
	}
}

let agent: MetricsAgent;

export const getMetricsAgent = () => {
	if (!agent) {
		agent = new MetricsAgent();
	}

	return agent;
};
