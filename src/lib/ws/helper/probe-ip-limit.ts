import _ from 'lodash';
import config from 'config';
import { scopedLogger } from '../../logger.js';
import { ProbeError } from '../../probe-error.js';
import type { IoContext } from '../../server.js';

const numberOfProcesses = config.get<number>('server.processes');

const logger = scopedLogger('ws:limit');

export class ProbeIpLimit {
	private timer: NodeJS.Timeout | undefined;

	constructor (
		private readonly fetchProbes: IoContext['fetchProbes'],
		private readonly fetchRawSockets: IoContext['fetchRawSockets'],
		private readonly getProbeByIp: IoContext['getProbeByIp'],
	) {}

	scheduleSync () {
		clearTimeout(this.timer);

		this.timer = setTimeout(() => {
			this.syncIpLimit()
				.finally(() => this.scheduleSync())
				.catch(error => logger.error('Error in ProbeIpLimit.syncIpLimit()', error));
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

		const previousProbe = await this.getProbeByIp(ip, { allowStale: false });

		if (previousProbe && previousProbe.client !== socketId) {
			logger.warn(`WS client ${socketId} has reached the concurrent IP limit.`, { message: previousProbe.ipAddress });
			throw new ProbeError('ip limit');
		}
	}
}

