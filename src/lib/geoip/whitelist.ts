import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { IPRangeList } from 'ip-range-list';

const WHITELIST_FILE_PATH = 'config/whitelist-ips.txt';

let isInitialized = false;
let whitelist = new IPRangeList();

export const populateMemList = async () => {
	const listFilePath = path.join(path.resolve(), WHITELIST_FILE_PATH);
	const file = await readFile(listFilePath, 'utf8');
	const entries = file.split(/\r?\n/).map(item => item.trim()).filter(item => item.length > 0);
	const newWhitelist = new IPRangeList();

	for (const entry of entries) {
		try {
			if (entry.includes('/')) {
				newWhitelist.addSubnet(entry);
			} else {
				newWhitelist.addAddress(entry);
			}
		} catch {}
	}

	whitelist = newWhitelist;
	isInitialized = true;
};

export const isAddrWhitelisted = (addr: string) => {
	if (!isInitialized) {
		throw new Error('Whitelist ips are not initialized');
	}

	return whitelist.contains(addr);
};
