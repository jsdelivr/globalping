import { IncomingMessage } from 'node:http';
import proxyaddr from 'proxy-addr';

const ipv4MappedPattern = /^::ffff:/i;

export const getIpFromRequest = (request: IncomingMessage) => {
	const ip = proxyaddr(request, (_address, index) => index < 1);

	if (!ip) {
		return ip;
	}

	if (ipv4MappedPattern.test(ip)) {
		return ip.slice(7);
	}

	return ip;
};
