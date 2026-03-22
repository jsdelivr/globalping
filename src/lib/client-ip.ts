import { IncomingMessage } from 'node:http';
import { isIP } from 'node:net';
import proxyaddr from 'proxy-addr';
import config from 'config';

const ipv4MappedPattern = /^::ffff:/i;

const trustedProxies = config.get<string[]>('server.trustedProxies');
const fastlySharedSecret = config.get<string>('server.fastlySharedSecret');
const trustPredicate = proxyaddr.compile([
	...trustedProxies,
	'loopback',
	'linklocal',
]);

const getFastlyClientIp = (req: IncomingMessage) => {
	if (!fastlySharedSecret) {
		return null;
	}

	const headerSecret = req.headers['fastly-shared-secret'];
	const providedSecret = Array.isArray(headerSecret) ? headerSecret[0] : headerSecret;

	if (providedSecret !== fastlySharedSecret) {
		return null;
	}

	const headerIp = req.headers['fastly-client-ip'];
	const fastlyClientIp = Array.isArray(headerIp) ? headerIp[0] : headerIp;

	if (!fastlyClientIp || !isIP(fastlyClientIp)) {
		return null;
	}

	return fastlyClientIp;
};

/**
 * Returns the real client IP, taking into account the configured trusted proxies.
 * Normalizes IPv4-mapped IPv6 address into IPv4.
 */
export const getIpFromRequest = (req: IncomingMessage) => {
	const fastlyClientIp = getFastlyClientIp(req);

	if (fastlyClientIp) {
		return fastlyClientIp;
	}

	const ip = proxyaddr(req, trustPredicate);

	if (ipv4MappedPattern.test(ip)) {
		return ip.slice(7);
	}

	return ip;
};
