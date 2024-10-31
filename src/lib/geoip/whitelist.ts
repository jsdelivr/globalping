import ipaddr from 'ipaddr.js';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const WHITELIST_FILE_PATH = 'config/whitelist-ips.txt';

let isInitialized = false;
const whitelistIps = new Set<string>();
let whitelistRanges: ReturnType<typeof ipaddr.parseCIDR>[] = [];
const whitelistRangesCache = new Set<string>();

export const populateMemList = async () => {
	const listFilePath = path.join(path.resolve(), WHITELIST_FILE_PATH);
	const file = await readFile(listFilePath, 'utf8');
	const whitelist = file.split(/\r?\n/).map(item => item.trim()).filter(item => item.length > 0);
	whitelistIps.clear();
	whitelistRanges = [];
	whitelistRangesCache.clear();

	for (const item of whitelist) {
		if (ipaddr.isValid(item)) {
			whitelistIps.add(item);
		} else if (ipaddr.isValidCIDR(item)) {
			const range = ipaddr.parseCIDR(item);
			whitelistRanges.push(range);
		}
	}

	isInitialized = true;
};

export const isAddrWhitelisted = (addr: string) => {
	if (!isInitialized) {
		throw new Error('Whitelist ips are not initialized');
	}

	if (whitelistIps.has(addr)) {
		return true;
	}

	if (isInWhitelistRanges(addr)) {
		return true;
	}

	return false;
};

const isInWhitelistRanges = (addr: string) => {
	if (whitelistRangesCache.has(addr)) {
		return true;
	}

	const ip = ipaddr.parse(addr);
	const isInRanges = whitelistRanges.some(range => ip.kind() === range[0].kind() && ip.match(range));

	if (isInRanges) {
		whitelistRangesCache.add(addr);
		return true;
	}

	return false;
};
