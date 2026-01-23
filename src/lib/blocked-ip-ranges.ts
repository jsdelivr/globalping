import { writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import got from 'got';
import ipaddr from 'ipaddr.js';

type ParsedIpRange = [ipaddr.IPv4 | ipaddr.IPv6, number];

type Source = {
	url: string;
	file: string;
};

export let blockedRangesIPv4 = new Set<ParsedIpRange>();
let blockedRangesIPv6 = new Set<ParsedIpRange>();
let ipsCache = new Map<string, boolean>();

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

const populateAppleRelayList = async (newBlockedRangesIPv4: Set<ParsedIpRange>, newBlockedRangesIPv6: Set<ParsedIpRange>) => {
	const appleRelaySource = sources.appleRelay;
	const filePath = path.join(path.resolve(), appleRelaySource.file);
	const csv = await readFile(filePath, 'utf8');

	csv.split('\n').forEach((line) => {
		const [ range ] = line.split(',');

		if (!range) {
			return;
		}

		const parsedRange = ipaddr.parseCIDR(range);

		if (parsedRange[0].kind() === 'ipv4') {
			newBlockedRangesIPv4.add(parsedRange);
		} else if (parsedRange[0].kind() === 'ipv6') {
			newBlockedRangesIPv6.add(parsedRange);
		}
	});
};

export const populateMemList = async (): Promise<void> => {
	const newBlockedRangesIPv4 = new Set<ParsedIpRange>();
	const newBlockedRangesIPv6 = new Set<ParsedIpRange>();

	await Promise.all([
		populateAppleRelayList(newBlockedRangesIPv4, newBlockedRangesIPv6),
	]);

	blockedRangesIPv4 = newBlockedRangesIPv4;
	blockedRangesIPv6 = newBlockedRangesIPv6;
	ipsCache = new Map<string, boolean>();
};

export const updateBlockedIpRangesFiles = async (): Promise<void> => {
	await Promise.all(Object.values(sources).map(async (source) => {
		const response = await query(source.url);
		const filePath = path.join(path.resolve(), source.file);
		await writeFile(filePath, response, 'utf8');
	}));
};

export const isIpBlocked = (ip: string) => {
	const cached = ipsCache.get(ip);

	if (cached !== undefined) {
		return cached;
	}

	const parsedIp = ipaddr.process(ip);

	if (parsedIp.kind() === 'ipv4') {
		for (const ipRange of blockedRangesIPv4) {
			if (parsedIp.match(ipRange)) {
				ipsCache.set(ip, true);
				return true;
			}
		}
	} else if (parsedIp.kind() === 'ipv6') {
		for (const ipRange of blockedRangesIPv6) {
			if (parsedIp.match(ipRange)) {
				ipsCache.set(ip, true);
				return true;
			}
		}
	}

	ipsCache.set(ip, false);
	return false;
};
