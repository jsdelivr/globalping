import got from 'got';
import {LocationInfo, normalizeCityName} from './client.js';

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

export const fastlyLookup = async (addr: string): Promise<LocationInfo[]> => {
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
			city: normalizeCityName(data.city),
			asn: result.as.number,
			latitude: data.latitude,
			longitude: data.longitude,
		});
	}

	return locations;
};
