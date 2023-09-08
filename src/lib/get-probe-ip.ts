import _ from 'lodash';
import requestIp from 'request-ip';
import type { Socket } from 'socket.io';

const getProbeIp = (socket: Socket) => {
	// Use random ip assigned by the API
	if (process.env['FAKE_PROBE_IP'] === 'api') {
		return _.sample([
			'18.200.0.1',
			'34.140.0.10',
			'95.155.94.127',
			'65.49.22.66',
			'185.229.226.83',
			'51.158.22.211',
			'131.255.7.26',
			'213.136.174.80',
			'94.214.253.78',
			'79.205.97.254',
		]);
	}

	// Use fake ip provided by the probe
	if (process.env['FAKE_PROBE_IP'] === 'probe') {
		return socket.handshake.query['fakeIp'] as string;
	}

	const clientIp = requestIp.getClientIp(socket.request);

	if (!clientIp) {
		return null;
	}

	const hasEmptyIpv6Prefix = clientIp.startsWith('::ffff:');
	return hasEmptyIpv6Prefix ? clientIp.slice(7) : clientIp;
};

export default getProbeIp;
