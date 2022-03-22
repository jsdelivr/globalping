import * as process from 'node:process';
import type {Server as SocketServer} from 'socket.io';
import type {Metrics} from '@appsignal/nodejs';

import {getWsServer, PROBES_NAMESPACE} from './ws/server.js';

export class MetricsAgent {
	private metrics: Metrics | undefined;
	private readonly io: SocketServer;

	constructor(io: SocketServer) {
		this.io = io;
	}

	async run() {
		if (process.env['NODE_ENV'] === 'test') {
			return;
		}

		// eslint-disable-next-line node/no-unsupported-features/es-syntax
		const appsignal = await import('./appsignal.js');
		this.metrics = appsignal.default.metrics();

		setInterval(this.intervalHandler.bind(this), 60 * 1000);
	}

	recordMeasurementTime(type: string, time: number): void {
		if (!this.metrics) {
			return;
		}

		this.metrics.addDistributionValue('measurement.time', time, {type});
	}

	recordMeasurement(type: string): void {
		if (!this.metrics) {
			return;
		}

		this.metrics.incrementCounter('measurement.count', 1, {type});
		this.recordMeasurementTotal();
	}

	private async intervalHandler(): Promise<void> {
		/*
     * TODO:
     * - add redis results counter
     */
		await this.updateProbeCount();
	}

	private async updateProbeCount(): Promise<void> {
		if (!this.metrics) {
			return;
		}

		const socketList = await this.io.of(PROBES_NAMESPACE).fetchSockets();
		this.metrics.setGauge('probe.count', socketList.length, {group: 'total'});
	}

	private recordMeasurementTotal(): void {
		if (!this.metrics) {
			return;
		}

		this.metrics.incrementCounter('measurement.count', 1, {type: 'total'});
	}
}

let agent: MetricsAgent;

export const getMetricsAgent = () => {
	if (!agent) {
		agent = new MetricsAgent(getWsServer());
	}

	return agent;
};
