import _ from 'lodash';
import requestIp from 'request-ip';
import type { Socket } from 'socket.io';

const getFakeIp = (socket: Socket) => {
	const fakeIpFromProbe = socket.handshake.query['fakeIp'] as string;

	if (fakeIpFromProbe) {
		return fakeIpFromProbe;
	}

	const fakeIpFromApi = _.sample([
		'18.200.0.1', // aws-eu-west-1
		'34.140.0.10', // gcp-europe-west1
		'95.155.94.127',
		'65.49.22.66',
		'185.229.226.83',
		'51.158.22.211',
		'131.255.7.26',
		'213.136.174.80',
		'94.214.253.78',
		'79.205.97.254',
	]);
	return fakeIpFromApi;
};

const getProbeIp = (socket: Socket) => {
	if (process.env['FAKE_PROBE_IP']) {
		return getFakeIp(socket);
	}

	const clientIp = requestIp.getClientIp(socket.request);

	if (!clientIp) {
		return null;
	}

	const hasEmptyIpv6Prefix = clientIp.startsWith('::ffff:');
	return hasEmptyIpv6Prefix ? clientIp.slice(7) : clientIp;
};

export default getProbeIp;
