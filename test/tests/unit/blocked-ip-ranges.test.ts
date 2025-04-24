import { expect } from 'chai';
import { isIpBlocked, blockedRangesIPv4, populateMemList } from '../../../src/lib/blocked-ip-ranges.js';
import ipaddr from 'ipaddr.js';

describe('blocked-ip-ranges', () => {
	after(async () => {
		await populateMemList();
	});

	describe('validate', () => {
		it('should check IPv4 ranges', () => {
			expect(isIpBlocked('172.224.226.1')).to.equal(true);
			expect(isIpBlocked('172.228.226.1')).to.equal(false);
		});

		it('should check IPv6 ranges', () => {
			expect(isIpBlocked('2a02:26f7:b000:4000::0001')).to.equal(true);
			expect(isIpBlocked('2a02:26f7:1337:4000::0001')).to.equal(false);
		});

		it('should cache results', () => {
			expect(isIpBlocked('172.224.226.1')).to.equal(true);
			expect(isIpBlocked('172.228.226.1')).to.equal(false);
			blockedRangesIPv4.add(ipaddr.parseCIDR('172.228.226.1/27'));
			expect(isIpBlocked('172.224.226.1')).to.equal(true);
			expect(isIpBlocked('172.228.226.1')).to.equal(false);
		});
	});
});
