import type { IncomingMessage } from 'node:http';
import requestIp from 'request-ip';

const getProbeIp = (request: IncomingMessage) => {
	const clientIp = requestIp.getClientIp(request);

	if (!clientIp) {
		return null;
	}

	const hasEmptyIpv6Prefix = clientIp.startsWith('::ffff:');
	return hasEmptyIpv6Prefix ? clientIp.slice(7) : clientIp;
};

export default getProbeIp;
