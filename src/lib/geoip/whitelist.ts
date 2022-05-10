import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {scopedLogger} from '../logger.js';

const logger = scopedLogger('geoip.whitelist');

const listFilePath = path.join(path.resolve(), 'config/whitelist-ips.txt');

const getFile = async (): Promise<string> => {
	let file = '';

	try {
		file = await readFile(listFilePath, 'utf8');
	} catch (error: unknown) {
		logger.debug('Whitelist fetch failed', error);
	}

	return file;
};

export const isAddrWhitelisted = async (addr: string): Promise<boolean> => {
	const file = await getFile();
	const ipList = file.split('/\r?\n/').map(item => item.trim());

	return ipList.includes(addr);
};
