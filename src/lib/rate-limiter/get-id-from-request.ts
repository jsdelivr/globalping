import { IncomingMessage } from 'node:http';
import { isIPv6 } from 'node:net';
import ipaddr from 'ipaddr.js';
import { getIpFromRequest } from '../client-ip.js';

export const getIdFromRequest = (req: IncomingMessage) => {
	const clientIp = getIpFromRequest(req);

	if (!clientIp) {
		return '';
	}

	if (isIPv6(clientIp)) {
		return ipaddr.IPv6.networkAddressFromCIDR(`${clientIp}/64`).toString();
	}

	return clientIp;
};
