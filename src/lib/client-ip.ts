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

const getSingleHeaderValue = (value: string | string[] | undefined) => {
	if (Array.isArray(value)) {
		if (value.length !== 1) {
			return undefined;
		}

		return value[0];
	}

	return value;
};

const normalizeIp = (ip: string) => {
	return ipv4MappedPattern.test(ip) ? ip.slice(7) : ip;
};

const getFastlyClientIp = (req: IncomingMessage) => {
	if (!fastlySharedSecret) {
		return null;
	}

	const headerSecret = getSingleHeaderValue(req.headers['fastly-shared-secret']);

	if (!headerSecret) {
		return null;
	}

	if (headerSecret !== fastlySharedSecret) {
		return null;
	}

	const fastlyClientIp = getSingleHeaderValue(req.headers['fastly-client-ip']);

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
		return normalizeIp(fastlyClientIp);
	}

	return normalizeIp(proxyaddr(req, trustPredicate));
};
