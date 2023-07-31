import got from 'got';
import { getApproximatedCity } from '../city-approximation.js';
import type { LocationInfo } from '../client.js';
import {
	normalizeCityName,
	normalizeCityNamePublic,
	normalizeNetworkName,
} from '../utils.js';

type FastlyResponse = {
	as: {
		name: string;
		number: number;
	};
	client: {
		proxy_desc: string;
		proxy_type: string;
	};
	'geo-digitalelement': {
		continent_code: string;
		country_code: string;
		city: string;
		region: string;
		latitude: number;
		longitude: number;
		network: string;
	};
};

export const fastlyLookup = async (addr: string): Promise<LocationInfo> => {
	const result = await got(`https://globalping-geoip.global.ssl.fastly.net/${addr}`, {
		timeout: { request: 5000 },
	}).json<FastlyResponse>();

	const data = result['geo-digitalelement'];

	const approximatedCity = await getApproximatedCity(data.country_code, Number(data.latitude), Number(data.longitude));

	return {
		continent: data.continent_code,
		country: data.country_code,
		state: data.country_code === 'US' ? data.region : undefined,
		city: normalizeCityNamePublic(approximatedCity ?? ''),
		normalizedCity: normalizeCityName(approximatedCity ?? ''),
		asn: result.as.number,
		latitude: data.latitude,
		longitude: data.longitude,
		network: result.as.name,
		normalizedNetwork: normalizeNetworkName(result.as.name),
	};
};
