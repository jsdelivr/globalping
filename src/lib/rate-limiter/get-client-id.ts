import { getClientIp } from 'request-ip';
import { isIPv6 } from 'node:net';
import ipaddr from 'ipaddr.js';
import { IncomingMessage } from 'node:http';

export const getClientId = (req: IncomingMessage, defaultIp: string = '') => {
	const clientIp = getClientIp(req) ?? defaultIp;

	if (isIPv6(clientIp)) {
		return ipaddr.IPv6.networkAddressFromCIDR(`${clientIp}/64`).toString();
	}

	return clientIp;
};
