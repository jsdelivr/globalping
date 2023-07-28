/**
 * How to run:
 * 1. Run redis instance
 * 2. Replace content of the known-probes.json with the known probes info in the same format
 * 3. Run with fulfilled keys: `IP_2_LOCATION_API_KEY= IPINFO_API_KEY= MAXMIND_ACCOUNT_ID= MAXMIND_LICENSE_KEY= npm run stats:known`
 */

import fs from 'node:fs';
import { getRedisClient, initRedis } from '../src/lib/redis/client.js';
import { LocationInfo, createGeoipClient } from '../src/lib/geoip/client.js';
import { normalizeCityName } from '../src/lib/geoip/utils.js';
import { fastlyLookup } from '../src/lib/geoip/providers/fastly.js';
import { ipinfoLookup } from '../src/lib/geoip/providers/ipinfo.js';
import { maxmindLookup } from '../src/lib/geoip/providers/maxmind.js';
import { populateMemList as populateIpWhiteList } from '../src/lib/geoip/whitelist.js';
import { Ip2LocationBundledResponse, ip2LocationLookup } from '../src/lib/geoip/providers/ip2location.js';
import { ipmapLookup } from '../src/lib/geoip/providers/ipmap.js';
import sheet from './known-probes.json' assert { type: 'json' };

await populateIpWhiteList();
await initRedis();
const geoIpClient = createGeoipClient();

const input: [string, (string) => Promise<LocationInfo>][] = [
	[ 'ip2location', async ip => (await geoIpClient.lookupWithCache<Ip2LocationBundledResponse>(`geoip:ip2location:${ip}`, async () => ip2LocationLookup(ip))).location ],
	[ 'ipmap', ip => geoIpClient.lookupWithCache<LocationInfo>(`geoip:ipmap:${ip}`, async () => ipmapLookup(ip)) ],
	[ 'ipinfo', ip => geoIpClient.lookupWithCache<LocationInfo>(`geoip:ipinfo:${ip}`, async () => ipinfoLookup(ip)) ],
	[ 'maxmind', ip => geoIpClient.lookupWithCache<LocationInfo>(`geoip:maxmind:${ip}`, async () => maxmindLookup(ip)) ],
	[ 'fastly', ip => geoIpClient.lookupWithCache<LocationInfo>(`geoip:fastly:${ip}`, async () => fastlyLookup(ip)) ],
	[ 'algorithm', ip => geoIpClient.lookup(ip) ],
];

const getData = async (input: [string, (string) => Promise<LocationInfo>][]) => {
	const result = [ [ 'ip', 'real city', ...input.map(provider => provider[0]) ] ];

	try {
		const rows = await Promise.all(sheet.map(async (row) => {
			const requests = input.map(provider => provider[1]);
			const responses = await Promise.all(requests.map(request => request(row.ip)));
			return [ row.ip, normalizeCityName(row.city), ...responses.map(response => response.normalizedCity) ];
		}));

		rows.forEach(row => result.push(row));
		return result;
	} catch (err) {
		console.log(err);
		throw err;
	}
};

const addAccuracy = (result: string[][]) => {
	const accuracyRow = [ 'accuracy:' ];

	for (let j = 1; j < result[0].length; j++) {
		let correctResults = 0;

		for (let i = 1; i < result.length; i++) {
			const realCity = result[i][1];
			const providerCity = result[i][j];

			if (realCity === providerCity) {
				correctResults++;
			}
		}

		const accuracy = (correctResults / (result.length - 1)).toFixed(2);
		accuracyRow.push(accuracy);
	}

	result.splice(1, 0, accuracyRow);

	return result;
};

const generateFiles = (result: string[][]) => {
	const csvContent = result.map(row => row.join(',')).join('\n');
	fs.writeFileSync('./probes-stats/known-result.csv', csvContent);
};

(async () => {
	const data = await getData(input);
	const dataWithAccuracy = addAccuracy(data);
	generateFiles(dataWithAccuracy);
	const redis = getRedisClient();
	await redis.disconnect();
})();
