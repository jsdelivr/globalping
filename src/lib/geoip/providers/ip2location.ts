import got from 'got';
import config from 'config';
import {
	getContinentByCountry,
	getStateIsoByName,
} from '../../location/location.js';
import type { LocationInfo } from '../client.js';
import {
	normalizeCityName,
	normalizeCityNamePublic,
	normalizeNetworkName,
} from '../utils.js';
import { getApproximatedCity } from '../city-approximation.js';

type Ip2LocationResponse = {
	ip?: string;
	country_code?: string;
	country_name?: string;
	region_name?: string;
	city_name?: string;
	zip_code?: string;
	time_zone?: string;
	asn?: string;
	latitude?: number;
	longitude?: number;
	as?: string;
	is_proxy?: boolean;
};

export type Ip2LocationBundledResponse = {
	location: LocationInfo,
	isProxy: boolean,
};

export const ip2LocationLookup = async (addr: string): Promise<Ip2LocationBundledResponse> => {
	const result = await got(`https://api.ip2location.io`, {
		searchParams: {
			key: config.get<string>('ip2location.apiKey'),
			ip: addr,
		},
		timeout: { request: 5000 },
	}).json<Ip2LocationResponse>();

	const approximatedCity = await getApproximatedCity(result.country_code, result.latitude, result.longitude);

	const location = {
		continent: result.country_code ? getContinentByCountry(result.country_code) : '',
		state: result.country_code === 'US' && result.region_name ? getStateIsoByName(result.region_name) : undefined,
		country: result.country_code ?? '',
		city: normalizeCityNamePublic(approximatedCity ?? ''),
		normalizedCity: normalizeCityName(approximatedCity ?? ''),
		asn: Number(result.asn) ?? 0,
		latitude: result.latitude ?? 0,
		longitude: result.longitude ?? 0,
		network: result.as ?? '',
		normalizedNetwork: normalizeNetworkName(result.as ?? ''),
	};

	return {
		location,
		isProxy: result.is_proxy ?? false,
	};
};
