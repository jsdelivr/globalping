import { fetchProbes } from '../server.js';
import { scopedLogger } from '../../logger.js';
import { ProbeError } from '../../probe-error.js';

const logger = scopedLogger('ws:limit');

export const verifyIpLimit = async (ip: string, socketId: string): Promise<void> => {
	if (process.env['FAKE_PROBE_IP'] || process.env['TEST_MODE'] === 'unit') {
		return;
	}

	const probes = await fetchProbes({ allowStale: false });
	const previousSocket = probes.find(p => p.ipAddress === ip && p.client !== socketId);

	if (previousSocket) {
		logger.info(`ws client ${socketId} has reached the concurrent IP limit.`, { message: previousSocket.ipAddress });
		throw new ProbeError('ip limit');
	}
};
