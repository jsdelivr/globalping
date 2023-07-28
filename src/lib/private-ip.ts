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
// IPv6
privateBlockList.addSubnet('::', 128, 'ipv6');
privateBlockList.addSubnet('::1', 128, 'ipv6');
privateBlockList.addSubnet('::ffff:0:0', 96, 'ipv6');
privateBlockList.addSubnet('64:ff9b::', 96, 'ipv6');
privateBlockList.addSubnet('64:ff9b:1::', 48, 'ipv6');
privateBlockList.addSubnet('100::', 64, 'ipv6');
privateBlockList.addSubnet('2001::', 32, 'ipv6');
privateBlockList.addSubnet('2001:20::', 28, 'ipv6');
privateBlockList.addSubnet('2001:db8::', 32, 'ipv6');
privateBlockList.addSubnet('2002::', 16, 'ipv6');
privateBlockList.addSubnet('fc00::', 7, 'ipv6');
privateBlockList.addSubnet('fe80::', 10, 'ipv6');
privateBlockList.addSubnet('ff00::', 8, 'ipv6');

export const isIpPrivate = (ip: string) => {
	const ipVersion = isIP(ip);

	if (ipVersion === 4) {
		return privateBlockList.check(ip, 'ipv4');
	}

	if (ipVersion === 6) {
		return privateBlockList.check(ip, 'ipv6');
	}

	// Not a valid IP
	return false;
};
