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

	/*
    * TODO:
    * - add measurement time record
  */

	recordMeasurement(type: string): void {
		if (!this.metrics) {
			return;
		}

		this.metrics.incrementCounter(`measurement.${type}.count`, 1);
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
		this.metrics.setGauge('probe.total.count', socketList.length);
	}

	private recordMeasurementTotal(): void {
		if (!this.metrics) {
			return;
		}

		this.metrics.incrementCounter('measurement.total.count', 1);
	}
}

let agent: MetricsAgent;

export const getMetricsAgent = () => {
	if (!agent) {
		agent = new MetricsAgent(getWsServer());
	}

	return agent;
};
