import _ from 'lodash';
import config from 'config';
import type { fetchProbes as serverFetchProbes, fetchRawSockets as serverFetchRawSockets } from '../server.js';
import { scopedLogger } from '../../logger.js';
import { ProbeError } from '../../probe-error.js';

const numberOfProcesses = config.get<number>('server.processes');

const logger = scopedLogger('ws:limit');

export class ProbeIpLimit {
	private timer: NodeJS.Timeout | undefined;

	constructor (
		private readonly fetchProbes: typeof serverFetchProbes,
		private readonly fetchRawSockets: typeof serverFetchRawSockets,
	) {}

	scheduleSync () {
		clearTimeout(this.timer);

		this.timer = setTimeout(() => {
			this.syncIpLimit()
				.finally(() => this.scheduleSync())
				.catch(error => logger.error(error));
		}, 60_000 * 2 * numberOfProcesses * Math.random()).unref();
	}

	async syncIpLimit () {
		const sockets = await this.fetchRawSockets();
		// Sorting sockets by id, so all workers will treat the same socket as "first".
		const sortedSockets = _.sortBy(sockets, [ 'id' ]);

		const uniqIpToSocketId = new Map<string, string>();

		for (const socket of sortedSockets) {
			const prevSocketId = uniqIpToSocketId.get(socket.data.probe.ipAddress);

			if (prevSocketId && prevSocketId !== socket.id) {
				logger.warn(`Probe ip duplication occured (${socket.data.probe.ipAddress}). First socket id: ${prevSocketId}, socket id to disconnect: ${socket.id}`);
				socket.disconnect();
			} else {
				uniqIpToSocketId.set(socket.data.probe.ipAddress, socket.id);
			}
		}
	}

	async verifyIpLimit (ip: string, socketId: string): Promise<void> {
		if (process.env['FAKE_PROBE_IP'] || process.env['TEST_MODE'] === 'unit') {
			return;
		}

		const probes = await this.fetchProbes({ allowStale: false });
		const previousProbe = probes.find(p => p.ipAddress === ip && p.client !== socketId);

		if (previousProbe) {
			logger.info(`ws client ${socketId} has reached the concurrent IP limit.`, { message: previousProbe.ipAddress });
			throw new ProbeError('ip limit');
		}
	}
}

