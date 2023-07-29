import { isIP, BlockList } from 'net';

const privateBlockList = new BlockList();

// https://en.wikipedia.org/wiki/Reserved_IP_addresses
// IPv4
privateBlockList.addSubnet('0.0.0.0', 8, 'ipv4');
privateBlockList.addSubnet('10.0.0.0', 8, 'ipv4');
privateBlockList.addSubnet('100.64.0.0', 10, 'ipv4');
privateBlockList.addSubnet('127.0.0.0', 8, 'ipv4');
privateBlockList.addSubnet('169.254.0.0', 16, 'ipv4');
privateBlockList.addSubnet('172.16.0.0', 12, 'ipv4');
privateBlockList.addSubnet('192.0.0.0', 24, 'ipv4');
privateBlockList.addSubnet('192.0.2.0', 24, 'ipv4');
privateBlockList.addSubnet('192.88.99.0', 24, 'ipv4');
privateBlockList.addSubnet('192.168.0.0', 16, 'ipv4');
privateBlockList.addSubnet('198.18.0.0', 15, 'ipv4');
privateBlockList.addSubnet('198.51.100.0', 24, 'ipv4');
privateBlockList.addSubnet('203.0.113.0', 24, 'ipv4');
privateBlockList.addSubnet('224.0.0.0', 4, 'ipv4');
privateBlockList.addSubnet('240.0.0.0', 4, 'ipv4');
privateBlockList.addAddress('255.255.255.255', 'ipv4');

export const isIpPrivate = (ip: string) => {
	const ipVersion = isIP(ip);

	if (ipVersion === 4) {
		return privateBlockList.check(ip, 'ipv4');
	}

	if (ipVersion === 6) {
		throw new Error('IPv6 not supported');
	}

	// Not a valid IP
	return false;
};
