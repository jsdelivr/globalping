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

// Cluster ranges by the first octet (IPv4) and the first hextet/segment (IPv6)
// IPv4 buckets: 0-255; IPv6 buckets: 0-65535 (created on demand)
// Assumes all IPv4 ranges are at least /8 and all IPv6 ranges are at least /16
const ipV4Ranges = new Map<number, Map<ParsedIpRange, string[]>>();
const ipV6Ranges = new Map<number, Map<ParsedIpRange, string[]>>();

export const sources: Record<'gcp' | 'aws' | 'azure' | 'oci', Source> = {
	gcp: {
		url: 'https://download.jsdelivr.com/GCP_IP_RANGES.json',
		file: 'data/GCP_IP_RANGES.json',
	},
	aws: {
		url: 'https://download.jsdelivr.com/AWS_IP_RANGES.json',
		file: 'data/AWS_IP_RANGES.json',
	},
	azure: {
		url: 'https://download.jsdelivr.com/AZURE_IP_RANGES.json',
		file: 'data/AZURE_IP_RANGES.json',
	},
	oci: {
		url: 'https://download.jsdelivr.com/OCI_IP_RANGES.json',
		file: 'data/OCI_IP_RANGES.json',
	},
};

const query = async (url: string): Promise<string> => {
	const result = await got(url, {
		timeout: { request: 5000 },
	}).text();

	return result;
};

const addIpv4Range = (cidr: string, tags: string[]) => {
	const parsed = ipaddr.parseCIDR(cidr);
	const firstOctet = (parsed[0] as ipaddr.IPv4).octets[0]!;

	if (!ipV4Ranges.has(firstOctet)) {
		ipV4Ranges.set(firstOctet, new Map());
	}

	ipV4Ranges.get(firstOctet)!.set(parsed, tags);
};

const addIpv6Range = (cidr: string, tags: string[]) => {
	const parsed = ipaddr.parseCIDR(cidr);
	const firstSeg = (parsed[0] as ipaddr.IPv6).parts[0]!;

	if (!ipV6Ranges.has(firstSeg)) {
		ipV6Ranges.set(firstSeg, new Map());
	}

	ipV6Ranges.get(firstSeg)!.set(parsed, tags);
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
			addIpv4Range(cidr, [ `gcp-${region}`, `gcp` ]);
		}
	}

	for (const [ region, entries ] of Object.entries(byRegionV6)) {
		for (const cidr of mergeCidr(entries.map(entry => entry.ipv6Prefix))) {
			addIpv6Range(cidr, [ `gcp-${region}`, `gcp` ]);
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
			addIpv4Range(cidr, [ `aws-${region}`, `aws` ]);
		}
	}

	for (const [ region, entries ] of Object.entries(byRegionV6)) {
		for (const cidr of mergeCidr(entries.map(entry => entry.ipv6_prefix))) {
			addIpv6Range(cidr, [ `aws-${region}`, `aws` ]);
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
			addIpv4Range(prefix, [ `azure-${region}`, `azure` ]);
		}

		for (const prefix of mergeCidr(v6)) {
			addIpv6Range(prefix, [ `azure-${region}`, `azure` ]);
		}
	}
}

export async function populateOracleList () {
	const ociSource = sources.oci;
	const filePath = path.join(path.resolve(), ociSource.file);
	const json = await readFile(filePath, 'utf8');
	const data = JSON.parse(json) as {
		regions: Array<{
			region: string;
			cidrs: Array<{
				cidr: string;
			}>;
		}>;
	};

	for (const { region, cidrs } of Object.values(data.regions)) {
		const v4: string[] = [];
		const v6: string[] = [];

		for (const { cidr } of cidrs) {
			if (ipaddr.parseCIDR(cidr)[0].kind() === 'ipv4') {
				v4.push(cidr);
			} else if (ipaddr.parseCIDR(cidr)[0].kind() === 'ipv6') {
				v6.push(cidr);
			}
		}

		for (const prefix of mergeCidr(v4)) {
			addIpv4Range(prefix, [ `oci-${region}`, `oci` ]);
		}

		for (const prefix of mergeCidr(v6)) {
			addIpv6Range(prefix, [ `oci-${region}`, `oci` ]);
		}
	}
}

export const populateMemList = async (): Promise<void> => {
	await Promise.all([
		populateGcpList(),
		populateAwsList(),
		populateAzureList(),
		populateOracleList(),
	]);
};

export const updateIpRangeFiles = async (): Promise<void> => {
	await Promise.all(Object.values(sources).map(async (source) => {
		const response = await query(source.url);
		const filePath = path.join(path.resolve(), source.file);
		await writeFile(filePath, response, 'utf8');
	}));
};

export const getCloudTags = (ip: string) => {
	const parsedIp = ipaddr.process(ip);

	if (parsedIp.kind() === 'ipv4') {
		const firstOctet = (parsedIp as ipaddr.IPv4).octets[0]!;
		const bucket = ipV4Ranges.get(firstOctet);

		if (bucket) {
			for (const [ ipRange, tags ] of bucket) {
				if (parsedIp.match(ipRange)) {
					return tags;
				}
			}
		}
	} else if (parsedIp.kind() === 'ipv6') {
		const firstSeg = (parsedIp as ipaddr.IPv6).parts[0]!;
		const bucket = ipV6Ranges.get(firstSeg);

		if (bucket) {
			for (const [ ipRange, tags ] of bucket) {
				if (parsedIp.match(ipRange)) {
					return tags;
				}
			}
		}
	}

	return [];
};
