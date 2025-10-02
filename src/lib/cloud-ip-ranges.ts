import { writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import got from 'got';
import _ from 'lodash';
import ipaddr from 'ipaddr.js';
import { mergeCidr } from 'cidr-tools';

type ParsedIpRange = [ipaddr.IPv4 | ipaddr.IPv6, number];

type Source = {
	url: string;
	file: string;
};

const ipV4Ranges = new Map<ParsedIpRange, string>();
const ipV6Ranges = new Map<ParsedIpRange, string>();

export const sources: Record<'gcp' | 'aws' | 'azure', Source> = {
	gcp: {
		url: 'https://www.gstatic.com/ipranges/cloud.json',
		file: 'data/GCP_IP_RANGES.json',
	},
	aws: {
		url: 'https://ip-ranges.amazonaws.com/ip-ranges.json',
		file: 'data/AWS_IP_RANGES.json',
	},
	azure: {
		url: 'https://download.microsoft.com/download/7/1/D/71D86715-5596-4529-9B13-DA13A5DE5B63/ServiceTags_Public_Latest.json',
		file: 'data/AZURE_IP_RANGES.json',
	},
};

const query = async (url: string): Promise<string> => {
	const result = await got(url, {
		timeout: { request: 5000 },
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

	const byRegionV4 = _.groupBy(data.prefixes.filter(prefix => prefix.scope && prefix.ipv4Prefix), 'scope');
	const byRegionV6 = _.groupBy(data.prefixes.filter(prefix => prefix.scope && prefix.ipv6Prefix), 'scope');

	for (const [ region, entries ] of Object.entries(byRegionV4)) {
		for (const cidr of mergeCidr(entries.map(entry => entry.ipv4Prefix))) {
			ipV4Ranges.set(ipaddr.parseCIDR(cidr), `gcp-${region}`);
		}
	}

	for (const [ region, entries ] of Object.entries(byRegionV6)) {
		for (const cidr of mergeCidr(entries.map(entry => entry.ipv6Prefix))) {
			ipV6Ranges.set(ipaddr.parseCIDR(cidr), `gcp-${region}`);
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

	const byRegionV4 = _.groupBy(data.prefixes.filter(prefix => prefix.region && prefix.ip_prefix), 'region');
	const byRegionV6 = _.groupBy(data.ipv6_prefixes.filter(prefix => prefix.region && prefix.ipv6_prefix), 'region');

	for (const [ region, entries ] of Object.entries(byRegionV4)) {
		for (const cidr of mergeCidr(entries.map(entry => entry.ip_prefix))) {
			ipV4Ranges.set(ipaddr.parseCIDR(cidr), `aws-${region}`);
		}
	}

	for (const [ region, entries ] of Object.entries(byRegionV6)) {
		for (const cidr of mergeCidr(entries.map(entry => entry.ipv6_prefix))) {
			ipV6Ranges.set(ipaddr.parseCIDR(cidr), `aws-${region}`);
		}
	}
};

export async function populateAzureList () {
	const azureSource = sources.azure;
	const filePath = path.join(path.resolve(), azureSource.file);
	const json = await readFile(filePath, 'utf8');
	const data = JSON.parse(json) as {
		values: Array<{
			properties: {
				region: string;
				addressPrefixes: string[];
			};
		}>;
	};

	const byRegion = _.groupBy(data.values.filter(entry => entry.properties.region), 'properties.region');

	for (const [ region, entries ] of Object.entries(byRegion)) {
		const v4: string[] = [];
		const v6: string[] = [];

		for (const entry of entries) {
			for (const addressPrefix of entry.properties.addressPrefixes) {
				if (ipaddr.parseCIDR(addressPrefix)[0].kind() === 'ipv4') {
					v4.push(addressPrefix);
				} else if (ipaddr.parseCIDR(addressPrefix)[0].kind() === 'ipv6') {
					v6.push(addressPrefix);
				}
			}
		}

		for (const prefix of mergeCidr(v4)) {
			ipV4Ranges.set(ipaddr.parseCIDR(prefix), `azure-${region}`);
		}

		for (const prefix of mergeCidr(v6)) {
			ipV6Ranges.set(ipaddr.parseCIDR(prefix), `azure-${region}`);
		}
	}
}

export const populateMemList = async (): Promise<void> => {
	await Promise.all([
		populateGcpList(),
		populateAwsList(),
		populateAzureList(),
	]);
};

export const updateIpRangeFiles = async (): Promise<void> => {
	await Promise.all(Object.values(sources).map(async (source) => {
		const response = await query(source.url);
		const filePath = path.join(path.resolve(), source.file);
		await writeFile(filePath, response, 'utf8');
	}));
};

export const getRegion = (ip: string) => {
	const parsedIp = ipaddr.process(ip);

	if (parsedIp.kind() === 'ipv4') {
		for (const [ ipRange, region ] of ipV4Ranges) {
			if (parsedIp.match(ipRange)) {
				return region;
			}
		}
	} else if (parsedIp.kind() === 'ipv6') {
		for (const [ ipRange, region ] of ipV6Ranges) {
			if (parsedIp.match(ipRange)) {
				return region;
			}
		}
	}

	return null;
};
