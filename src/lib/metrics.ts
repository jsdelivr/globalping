import type {Server as SocketServer} from 'socket.io';
import type {Metrics} from '@appsignal/nodejs';

import {getRedisClient, RedisClient} from '../lib/redis/client.js';
import {getWsServer, PROBES_NAMESPACE} from './ws/server.js';
import Appsignal from './appsignal.js';

export class MetricsAgent {
	private readonly metrics: Metrics;
	private readonly io: SocketServer;
	private readonly redis: RedisClient;

	private interval: any;

	constructor(io: SocketServer, redis: RedisClient) {
		this.io = io;
		this.redis = redis;
		this.metrics = Appsignal.metrics();
	}

	run() {
		this.interval = setInterval(this.intervalHandler.bind(this), 60 * 1000);
	}

	stop() {
		clearInterval(this.interval);
	}

	recordMeasurementTime(type: string, time: number): void {
		this.metrics.addDistributionValue('measurement.time', time, {type});
	}

	recordMeasurement(type: string): void {
		this.metrics.incrementCounter('measurement.count', 1, {type});
		this.recordMeasurementTotal();
	}

	private async intervalHandler(): Promise<void> {
		await this.updateProbeCount();
		await this.updateMeasurementCount();
	}

	private async updateProbeCount(): Promise<void> {
		const socketList = await this.io.of(PROBES_NAMESPACE).fetchSockets();
		this.metrics.setGauge('probe.count', socketList.length, {group: 'total'});
	}

	private async updateMeasurementCount(): Promise<void> {
		let count = 0;

		// eslint-disable-next-line @typescript-eslint/naming-convention, no-empty-pattern
		for await ({} of this.redis.scanIterator({MATCH: 'gp:measurement:*'})) {
			count++;
		}

		this.metrics.setGauge('measurement.record.count', count, {type: 'total'});
	}

	private recordMeasurementTotal(): void {
		this.metrics.incrementCounter('measurement.count', 1, {type: 'total'});
	}
}

let agent: MetricsAgent;

export const getMetricsAgent = () => {
	if (!agent) {
		agent = new MetricsAgent(getWsServer(), getRedisClient());
	}

	return agent;
};
