import { writeFile, readFile } from 'node:fs/promises';
import got from 'got';
import { IPRangeList } from 'ip-range-list';
import { fromProjectRoot } from './paths.js';

type Source = {
	url: string;
	file: string;
};

let blockedIpRanges = new IPRangeList();

export const sources: Record<'appleRelay', Source> = {
	appleRelay: {
		url: 'https://download.jsdelivr.com/APPLE_RELAY_IP_RANGES.csv',
		file: 'data/APPLE_RELAY_IP_RANGES.csv',
	},
};

const query = async (url: string): Promise<string> => {
	const result = await got(url, {
		timeout: { request: 10000 },
	}).text();

	return result;
};

const populateAppleRelayList = async (newBlockedIpRanges: IPRangeList) => {
	const appleRelaySource = sources.appleRelay;
	const filePath = fromProjectRoot(appleRelaySource.file);
	const csv = await readFile(filePath, 'utf8');

	csv.split('\n').forEach((line) => {
		const [ range ] = line.split(',');

		if (!range) {
			return;
		}

		newBlockedIpRanges.addSubnet(range);
	});
};

export const populateMemList = async (): Promise<void> => {
	const newBlockedIpRanges = new IPRangeList();

	await Promise.all([
		populateAppleRelayList(newBlockedIpRanges),
	]);

	blockedIpRanges = newBlockedIpRanges;
};

export const updateBlockedIpRangesFiles = async (): Promise<void> => {
	await Promise.all(Object.values(sources).map(async (source) => {
		const response = await query(source.url);
		const filePath = fromProjectRoot(source.file);
		await writeFile(filePath, response, 'utf8');
	}));
};

export const isIpBlocked = (ip: string) => blockedIpRanges.contains(ip);
