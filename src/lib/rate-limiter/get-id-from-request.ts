import type { Request } from 'koa';
import { isIPv6 } from 'node:net';
import ipaddr from 'ipaddr.js';

export const getIdFromRequest = (request: Request) => {
	const clientIp = request.ip;

	if (!clientIp) {
		return '';
	}

	if (isIPv6(clientIp)) {
		return ipaddr.IPv6.networkAddressFromCIDR(`${clientIp}/64`).toString();
	}

	return clientIp;
};
