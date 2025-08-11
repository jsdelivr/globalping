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

/**
 * Returns the real client IP, taking into account the configured trusted proxies.
 * Normalizes IPv4-mapped IPv6 address into IPv4.
 */
export const getIpFromRequest = (req: IncomingMessage) => {
	const ip = proxyaddr(req, trustPredicate);

	if (ipv4MappedPattern.test(ip)) {
		return ip.slice(7);
	}

	return ip;
};
