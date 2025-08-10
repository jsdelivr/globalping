import requestIp from 'request-ip';

export const getIpFromRequest = (request: requestIp.Request) => {
	const ip = requestIp.getClientIp(request);

	if (!ip) {
		return ip;
	}

	if (ip.startsWith('::ffff:')) {
		return ip.slice(7);
	}

	return ip;
};
