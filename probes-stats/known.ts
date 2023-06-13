/**
 * How to run:
 * 1. Run redis instance
 * 2. Replace content of the known-probes.json with the known probes info in the same format
 * 3. Run with fulfilled keys: `IPINFO_API_KEY= MAXMIND_ACCOUNT_ID= MAXMIND_LICENSE_KEY= npm run stats:known`
 */

import fs from 'node:fs';
import { initRedis } from '../src/lib/redis/client.js';
import { LocationInfo, createGeoipClient } from '../src/lib/geoip/client.js';
import { normalizeCityName } from '../src/lib/geoip/utils.js';
import { FastlyBundledResponse, fastlyLookup } from '../src/lib/geoip/providers/fastly.js';
import { ipinfoLookup } from '../src/lib/geoip/providers/ipinfo.js';
import { maxmindLookup } from '../src/lib/geoip/providers/maxmind.js';
import sheet from './known-probes.json' assert { type: 'json' };

await initRedis();
const geoIpClient = createGeoipClient();

type ResultItem = {
	ip: string,
	city: string,
	ipinfo: string,
	maxmind: string,
	fastly: string,
	algorithm: string,
	country: string,
	note: string,
};

const getData = async () => {
	const result: ResultItem[] = [];

	for (const row of sheet) {
		const normalizedCity = normalizeCityName(row.city);

		const ipinfo = await geoIpClient.lookupWithCache<LocationInfo>(`geoip:ipinfo:${row.ip}`, async () => ipinfoLookup(row.ip));
		const maxmind = await geoIpClient.lookupWithCache<LocationInfo>(`geoip:maxmind:${row.ip}`, async () => maxmindLookup(row.ip));
		const fastly = await geoIpClient.lookupWithCache<FastlyBundledResponse>(`geoip:fastly:${row.ip}`, async () => fastlyLookup(row.ip));

		const updatedRow = {
			...row,
			city: normalizedCity,
			ipinfo: ipinfo.normalizedCity,
			maxmind: maxmind.normalizedCity,
			fastly: fastly.location.normalizedCity,
		} as ResultItem;

		try {
			const location = await geoIpClient.lookup(row.ip);
			updatedRow['algorithm'] = location.normalizedCity;
		} catch (err) {
			updatedRow['algorithm'] = err.message.toUpperCase();
		}

		result.push(updatedRow);
	}

	return result;
};

const getAccuracy = (result) => {
	const ipinfoTrueCount = result.filter(row => row.ipinfo === row.city).length;
	const maxmindTrueCount = result.filter(row => row.maxmind === row.city).length;
	const fastlyTrueCount = result.filter(row => row.fastly === row.city).length;
	const algorithmTrueCount = result.filter(row => row.algorithm === row.city).length;
	return {
		ipinfo: (ipinfoTrueCount / result.length).toFixed(2),
		maxmind: (maxmindTrueCount / result.length).toFixed(2),
		fastly: (fastlyTrueCount / result.length).toFixed(2),
		algorithm: (algorithmTrueCount / result.length).toFixed(2),
	};
};

const generateFiles = (data: ResultItem[], acc: {ipinfo: string, maxmind: string, fastly: string, algorithm: string}) => {
	const csvContent = [
		'ip,city,ipinfo,maxmind,fastly,algorithm',
		`accuracy:,1,${acc.ipinfo},${acc.maxmind},${acc.fastly},${acc.algorithm}`,
		...data.map(row => `${row.ip},${row.city},${row.ipinfo},${row.maxmind},${row.fastly},${row.algorithm}`),
	].join('\n');
	fs.writeFileSync('./probes-stats/result.json', JSON.stringify(data, null, 2));
	fs.writeFileSync('./probes-stats/result.csv', csvContent);
};

(async () => {
	const data = await getData();
	const acc = getAccuracy(data);
	generateFiles(data, acc);
	console.log('Finished!');
})();
