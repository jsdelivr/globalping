import { IncomingMessage } from 'node:http';
import proxyaddr from 'proxy-addr';
import config from 'config';

const ipv4MappedPattern = /^::ffff:/i;

const trustedProxies = config.get<string[]>('server.trustedProxies');
const trustPredicate = proxyaddr.compile([
	...trustedProxies,
	'loopback',
	'linklocal',
]);

export const getIpFromRequest = (request: IncomingMessage) => {
	const ip = proxyaddr(request, trustPredicate);

	if (!ip) {
		return ip;
	}

	if (ipv4MappedPattern.test(ip)) {
		return ip.slice(7);
	}

	return ip;
};
