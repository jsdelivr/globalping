import {readFile} from 'node:fs/promises';
import path from 'node:path';

const WHITELIST_FILE_PATH = 'config/whitelist-ips.txt';

let whiteListIps: Set<string>;

export const populateMemList = async () => {
	const listFilePath = path.join(path.resolve(), WHITELIST_FILE_PATH);
	const file = await readFile(listFilePath, 'utf8');
	const ipList = file.split(/\r?\n/).map(item => item.trim()).filter(item => item.length > 0);
	whiteListIps = new Set(ipList);
};

export const isAddrWhitelisted = (addr: string) => {
	if (!whiteListIps) {
		throw new Error('Whitelist ips are not initialized');
	}

	return whiteListIps.has(addr);
};
