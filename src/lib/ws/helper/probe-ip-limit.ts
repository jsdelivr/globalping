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
		}, 60_000 * 2 * Math.random() * numberOfProcesses).unref();
	}

	async syncIpLimit () {
		const probes = await this.fetchProbes();
		// Sorting probes by "client" (socket id), so all workers will treat the same probe as "first".
		const sortedProbes = _.sortBy(probes, [ 'client' ]);

		const ipToSocketId = new Map<string, string>();
		const socketIdsToDisconnect = new Set<string>();

		for (const probe of sortedProbes) {
			const prevSocketId = ipToSocketId.get(probe.ipAddress);

			if (prevSocketId && prevSocketId !== probe.client) {
				logger.warn(`Probe ip duplication occurred (${probe.ipAddress}). Socket id to preserve: ${prevSocketId}, socket id to disconnect: ${probe.client}`);
				socketIdsToDisconnect.add(probe.client);
			} else {
				ipToSocketId.set(probe.ipAddress, probe.client);
			}
		}

		if (socketIdsToDisconnect.size > 0) {
			const sockets = await this.fetchRawSockets();
			sockets
				.filter(socket => socketIdsToDisconnect.has(socket.id))
				.forEach(socket => socket.disconnect());
		}
	}

	async verifyIpLimit (ip: string, socketId: string): Promise<void> {
		if (process.env['FAKE_PROBE_IP'] || process.env['TEST_MODE'] === 'unit') {
			return;
		}

		const probes = await this.fetchProbes({ allowStale: false });
		const previousProbe = probes.find(p => p.ipAddress === ip && p.client !== socketId);

		if (previousProbe) {
			logger.warn(`ws client ${socketId} has reached the concurrent IP limit.`, { message: previousProbe.ipAddress });
			throw new ProbeError('ip limit');
		}
	}
}

