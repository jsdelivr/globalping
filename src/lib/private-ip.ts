import { IPRangeList } from 'ip-range-list';

const privateIpRanges = new IPRangeList();

// https://en.wikipedia.org/wiki/Reserved_IP_addresses
// IPv4
privateIpRanges.addSubnet('0.0.0.0/8');
privateIpRanges.addSubnet('10.0.0.0/8');
privateIpRanges.addSubnet('100.64.0.0/10');
privateIpRanges.addSubnet('127.0.0.0/8');
privateIpRanges.addSubnet('169.254.0.0/16');
privateIpRanges.addSubnet('172.16.0.0/12');
privateIpRanges.addSubnet('192.0.0.0/24');
privateIpRanges.addSubnet('192.0.2.0/24');
privateIpRanges.addSubnet('192.88.99.0/24');
privateIpRanges.addSubnet('192.168.0.0/16');
privateIpRanges.addSubnet('198.18.0.0/15');
privateIpRanges.addSubnet('198.51.100.0/24');
privateIpRanges.addSubnet('203.0.113.0/24');
privateIpRanges.addSubnet('224.0.0.0/4');
privateIpRanges.addSubnet('240.0.0.0/4');
privateIpRanges.addAddress('255.255.255.255');

// https://www.iana.org/assignments/iana-ipv6-special-registry/iana-ipv6-special-registry.xhtml
// IPv6
privateIpRanges.addSubnet('::/128');
privateIpRanges.addSubnet('::1/128');
privateIpRanges.addSubnet('64:ff9b:1::/48');
privateIpRanges.addSubnet('100::/64');
privateIpRanges.addSubnet('2001::/32');
privateIpRanges.addSubnet('2001:10::/28');
privateIpRanges.addSubnet('2001:20::/28');
privateIpRanges.addSubnet('2001:db8::/32');
privateIpRanges.addSubnet('2002::/16');
privateIpRanges.addSubnet('fc00::/7');
privateIpRanges.addSubnet('fe80::/10');
privateIpRanges.addSubnet('ff00::/8');

export const isIpPrivate = (ip: string) => {
	return privateIpRanges.contains(ip);
};
