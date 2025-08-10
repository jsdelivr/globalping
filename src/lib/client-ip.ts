import requestIp from 'request-ip';

const ipv4MappedPattern = /^::ffff:/i;

export const getIpFromRequest = (request: requestIp.Request) => {
	const ip = requestIp.getClientIp(request);

	if (!ip) {
		return ip;
	}

	if (ipv4MappedPattern.test(ip)) {
		return ip.slice(7);
	}

	return ip;
};
