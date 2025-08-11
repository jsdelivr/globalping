import { isIPv6 } from 'node:net';
import ipaddr from 'ipaddr.js';
import koa from 'koa';

export const getIdFromRequest = (request: koa.Request) => {
	const clientIp = request.ip;

	if (!clientIp) {
		return '';
	}

	if (isIPv6(clientIp)) {
		return ipaddr.IPv6.networkAddressFromCIDR(`${clientIp}/64`).toString();
	}

	return clientIp;
};
