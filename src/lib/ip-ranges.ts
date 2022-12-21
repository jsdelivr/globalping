import {writeFile, readFile} from 'node:fs/promises';
import path from 'node:path';
import got from 'got';
import ipaddr from 'ipaddr.js';

type ParsedIpRange = [ipaddr.IPv4 | ipaddr.IPv6, number];

type Source = {
	url: string;
	file: string;
};

const ipV4Ranges = new Map<ParsedIpRange, string>();
const ipV6Ranges = new Map<ParsedIpRange, string>();

export const sources: Record<'gcp' | 'aws', Source> = {
	gcp: {
		url: 'https://www.gstatic.com/ipranges/cloud.json',
		file: 'GCP_IP_RANGES.json',
	},
	aws: {
		url: 'https://ip-ranges.amazonaws.com/ip-ranges.json',
		file: 'AWS_IP_RANGES.json',
	},
};

const query = async (url: string): Promise<string> => {
	const result = await got(url, {
		timeout: {request: 5000},
	}).text();

	return result;
};

const populateGcpList = async () => {
	const gcpSource = sources.gcp;
	const filePath = path.join(path.resolve(), gcpSource.file);
	const json = await readFile(filePath, 'utf8');
	const data = JSON.parse(json) as {
		prefixes: Array<{
			ipv4Prefix: string;
			ipv6Prefix: string;
			scope: string;
		}>;
	};
	for (const {ipv4Prefix, ipv6Prefix, scope} of data.prefixes) {
		if (ipv4Prefix) {
			ipV4Ranges.set(ipaddr.parseCIDR(ipv4Prefix), `gcp-${scope}`);
		} else if (ipv6Prefix) {
			ipV6Ranges.set(ipaddr.parseCIDR(ipv6Prefix), `gcp-${scope}`);
		}
	}
};

const populateAwsList = async () => {
	const awsSource = sources.aws;
	const filePath = path.join(path.resolve(), awsSource.file);
	const json = await readFile(filePath, 'utf8');
	const data = JSON.parse(json) as {
		prefixes: Array<{
			ip_prefix: string;
			region: string;
		}>;
		ipv6_prefixes: Array<{
			ipv6_prefix: string;
			region: string;
		}>;
	};
	// eslint-disable-next-line @typescript-eslint/naming-convention
	for (const {ip_prefix, region} of data.prefixes) {
		ipV4Ranges.set(ipaddr.parseCIDR(ip_prefix), `aws-${region}`);
	}

	// eslint-disable-next-line @typescript-eslint/naming-convention
	for (const {ipv6_prefix, region} of data.ipv6_prefixes) {
		ipV6Ranges.set(ipaddr.parseCIDR(ipv6_prefix), `aws-${region}`);
	}
};

export const populateMemList = async (): Promise<void> => {
	await Promise.all([
		populateGcpList(),
		populateAwsList(),
	]);
};

export const updateIpRangeFiles = async (): Promise<void> => {
	await Promise.all(Object.values(sources).map(async source => {
		const response = await query(source.url);
		const filePath = path.join(path.resolve(), source.file);
		await writeFile(filePath, response, 'utf8');
	}));
};

export const getRegion = (ip: string) => {
	const parsedIp = ipaddr.process(ip);
	if (parsedIp.kind() === 'ipv4') {
		for (const [ipRange, region] of ipV4Ranges) {
			// eslint-disable-next-line unicorn/prefer-regexp-test
			if (parsedIp.match(ipRange)) {
				return region;
			}
		}
	} else if (parsedIp.kind() === 'ipv6') {
		for (const [ipRange, region] of ipV6Ranges) {
			// eslint-disable-next-line unicorn/prefer-regexp-test
			if (parsedIp.match(ipRange)) {
				return region;
			}
		}
	}

	return null;
};
