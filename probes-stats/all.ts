/**
 * How to run:
 * 1. Run redis instance
 * 2. Run with fulfilled keys: `ADMIN_KEY= IPINFO_API_KEY= MAXMIND_ACCOUNT_ID= MAXMIND_LICENSE_KEY= npm run stats:all`
 */

import got from 'got';
import fs from 'node:fs';
import { getRedisClient, initRedis } from '../src/lib/redis/client.js';
import { LocationInfo, createGeoipClient } from '../src/lib/geoip/client.js';
import { FastlyBundledResponse, fastlyLookup } from '../src/lib/geoip/providers/fastly.js';
import { ipinfoLookup } from '../src/lib/geoip/providers/ipinfo.js';
import { maxmindLookup } from '../src/lib/geoip/providers/maxmind.js';
import { populateMemList as populateIpWhiteList } from '../src/lib/geoip/whitelist.js';

await populateIpWhiteList();
await initRedis();
const geoIpClient = createGeoipClient();

type ResultItem = {
	ip: string,
	ipinfo: string,
	maxmind: string,
	fastly: string,
	algorithm: string,
};

const getData = async () => {
	const result: ResultItem[] = [];
	const probes = await got(`https://api.globalping.io/v1/probes?adminkey=${process.env['ADMIN_KEY']}`).json<{ipAddress: string}[]>();

	await Promise.all(probes.map(async (probe) => {
		const ip = probe.ipAddress;

		const ipinfo = await geoIpClient.lookupWithCache<LocationInfo>(`geoip:ipinfo:${ip}`, async () => ipinfoLookup(ip)).catch(err => ({ normalizedCity: err.message.toUpperCase() }));
		const maxmind = await geoIpClient.lookupWithCache<LocationInfo>(`geoip:maxmind:${ip}`, async () => maxmindLookup(ip)).catch(err => ({ normalizedCity: err.message.toUpperCase() }));
		const fastly = await geoIpClient.lookupWithCache<FastlyBundledResponse>(`geoip:fastly:${ip}`, async () => fastlyLookup(ip)).catch(err => ({ location: { normalizedCity: err.message.toUpperCase() } }));

		const updatedRow = {
			ip,
			ipinfo: ipinfo.normalizedCity,
			maxmind: maxmind.normalizedCity,
			fastly: fastly.location.normalizedCity,
		} as ResultItem;

		try {
			const location = await geoIpClient.lookup(ip);
			updatedRow['algorithm'] = location.normalizedCity;
		} catch (err) {
			updatedRow['algorithm'] = err.message.toUpperCase();
		}

		result.push(updatedRow);
	}));

	return result;
};

const generateFiles = (data: ResultItem[]) => {
	const csvContent = [
		'ip,ipinfo,maxmind,fastly,algorithm',
		...data.map(row => `${row.ip},${row.ipinfo},${row.maxmind},${row.fastly},${row.algorithm}`),
	].join('\n');
	fs.writeFileSync('./probes-stats/all-result.json', JSON.stringify(data, null, 2));
	fs.writeFileSync('./probes-stats/all-result.csv', csvContent);
};

(async () => {
	const data = await getData();
	generateFiles(data);
	const redis = getRedisClient();
	await redis.disconnect();
})();
