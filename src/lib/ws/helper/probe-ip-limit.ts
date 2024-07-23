import _ from 'lodash';
import config from 'config';
import type { fetchProbes as serverFetchProbes, fetchRawSockets as serverFetchRawSockets, getProbeByIp as serverGetProbeByIp } from '../server.js';
import { scopedLogger } from '../../logger.js';
import { ProbeError } from '../../probe-error.js';

const numberOfProcesses = config.get<number>('server.processes');

const logger = scopedLogger('ws:limit');

export class ProbeIpLimit {
	private timer: NodeJS.Timeout | undefined;

	constructor (
		private readonly fetchProbes: typeof serverFetchProbes,
		private readonly fetchRawSockets: typeof serverFetchRawSockets,
		private readonly getProbeByIp: typeof serverGetProbeByIp,
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
		if (process.env['FAKE_PROBE_IP']) {
			return;
		}

		const probes = await this.fetchProbes();
		// Sorting probes by "client" (socket id), so all workers will treat the same probe as "first".
		const sortedProbes = _.sortBy(probes, [ 'client' ]);

		const ipToSocketId = new Map<string, string>();
		const socketIdsToDisconnect = new Set<string>();

		for (const probe of sortedProbes) {
			for (const ip of [ probe.ipAddress, ...probe.altIpAddresses ]) {
				const prevSocketId = ipToSocketId.get(ip);

				if (prevSocketId && prevSocketId !== probe.client) {
					logger.warn(`Probe ip duplication occurred (${ip}). Socket id to preserve: ${prevSocketId}, socket id to disconnect: ${probe.client}`);
					socketIdsToDisconnect.add(probe.client);
				} else {
					ipToSocketId.set(ip, probe.client);
				}
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

		await this.fetchProbes({ allowStale: false });
		const previousProbe = this.getProbeByIp(ip);

		if (previousProbe && previousProbe.client !== socketId) {
			logger.warn(`ws client ${socketId} has reached the concurrent IP limit.`, { message: previousProbe.ipAddress });
			throw new ProbeError('ip limit');
		}
	}
}

