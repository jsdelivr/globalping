import _ from 'lodash';
import got from 'got';
import config from 'config';
import anyAscii from 'any-ascii';
import type {ProbeLocation} from '../../probe/types.js';

type LocationInfo = Omit<ProbeLocation, 'region'>;
type IpInfoResponse = {
	country: string;
	city: string;
	region: string;
	org: string;
	loc: string;
};

type FastlyGeoInfo = {
	continent_code: string;
	country_code: string;
	city: string;
	region: string;
	latitude: number;
	longitude: number;
};
type FastlyResponse = {
	as: {
		number: number;
	};
	'geo-digitalelement': FastlyGeoInfo;
	'geo-maxmind': FastlyGeoInfo;
};

const normalize = (string_: string): string => anyAscii(string_).toLowerCase();

const bestMatch = (field: keyof LocationInfo, sources: LocationInfo[]): LocationInfo => {
	const ranked = _.flatMap(Object.fromEntries(_.orderBy(_.entries(_.groupBy(sources, field)), ([, v]) => v.length, 'desc')));

	return ranked[0]!;
};

const fastlyLookup = async (addr: string): Promise<LocationInfo[]> => {
	const result = await got(`https://globalping-geoip.global.ssl.fastly.net/${addr}`, {
		timeout: {request: 5000},
	}).json<FastlyResponse>();

	const locations: LocationInfo[] = [];

	for (const field of ['geo-digitalelement', 'geo-maxmind']) {
		const data = result[field as keyof FastlyResponse] as FastlyGeoInfo;

		locations.push({
			continent: data.continent_code,
			country: data.country_code,
			state: data.country_code === 'US' ? data.region : undefined,
			city: normalize(data.city),
			asn: result.as.number,
			latitude: data.latitude,
			longitude: data.longitude,
		});
	}

	return locations;
};

const ipInfoLookup = async (addr: string): Promise<LocationInfo> => {
	const result = await got(`https://ipinfo.io/${addr}`, {
		username: config.get<string>('ipInfo.apiKey'),
		timeout: {request: 5000},
	}).json<IpInfoResponse>();

	const [lat, lon] = result.loc.split(',');
	const match = /^AS(\d+)/.exec(result.org);
	const parsedAsn = match?.[1] ? Number(match[1]) : null;

	return {
		continent: undefined!,
		state: undefined,
		country: result.country,
		city: normalize(result.city),
		asn: parsedAsn!,
		latitude: Number(lat),
		longitude: Number(lon),
	};
};

export const geoIpLookup = async (addr: string): Promise<LocationInfo> => {
	const results = await Promise
		.allSettled([ipInfoLookup(addr), fastlyLookup(addr)])
		.then(([ipInfo, fastly]) => {
			const fulfilled = [];

			fulfilled.push(ipInfo.status === 'fulfilled' ? ipInfo.value : null, fastly.status === 'fulfilled' ? fastly.value : null);

			return fulfilled.filter(v => v !== null).flat();
		}) as LocationInfo[];

	return {
		continent: bestMatch('continent', results).continent,
		country: bestMatch('country', results).country,
		state: bestMatch('state', results).state,
		city: bestMatch('city', results).city,
		asn: Number(bestMatch('asn', results).asn),
		latitude: Number(bestMatch('city', results).latitude),
		longitude: Number(bestMatch('city', results).longitude),
	};
};
