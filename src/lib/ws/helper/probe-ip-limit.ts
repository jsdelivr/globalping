import { fetchSockets } from '../server.js';
import { scopedLogger } from '../../logger.js';
import { InternalError } from '../../internal-error.js';
import type { LRUOptions } from './throttle.js';

const logger = scopedLogger('ws:limit');

export const verifyIpLimit = async (ip: string, socketId: string): Promise<void> => {
	if (process.env['FAKE_PROBE_IP'] === 'api') {
		return;
	}

	const status: LRUOptions['status'] = {};
	let socketList = await fetchSockets({ forceRefresh: true, status });

	// If another fetchSockets was already 'inflight' at the moment of a new fetchSockets call, result socketList may be stale, so we need to refetch it.
	if (status.fetch === 'inflight') {
		socketList = await fetchSockets({ forceRefresh: true });
	}

	const previousSocket = socketList.find(s => s.data.probe.ipAddress === ip && s.id !== socketId);

	if (previousSocket) {
		logger.info(`ws client ${socketId} has reached the concurrent IP limit.`, { message: previousSocket.data.probe.ipAddress });
		throw new InternalError('ip limit', true);
	}
};
