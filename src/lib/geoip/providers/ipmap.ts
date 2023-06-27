import got from 'got';
import {
	getContinentByCountry,
	getStateIsoByName,
} from '../../location/location.js';
import type { LocationInfo } from '../client.js';
import {
	normalizeCityName,
	normalizeCityNamePublic,
} from '../utils.js';

export type IpmapResponse = {
	locations: {
		cityName?: string;
    stateAnsiCode?: string;
    countryCodeAlpha2?: string;
		latitude?: string;
		longitude?: string;
	}[]
};

export const ipmapLookup = async (addr: string): Promise<LocationInfo> => {
	const result = await got.get(`https://ipmap-api.ripe.net/v1/locate/${addr}`).json<IpmapResponse>();
	const location = result?.locations?.[0];

	if (!location) {
		throw new Error('No ipmap location data.');
	}

	return {
		continent: getContinentByCountry(location.countryCodeAlpha2 ?? ''),
		state: location.countryCodeAlpha2 === 'US' ? getStateIsoByName(location.stateAnsiCode ?? '') : undefined,
		country: location.countryCodeAlpha2 ?? '',
		city: normalizeCityNamePublic(location.cityName ?? ''),
		normalizedCity: normalizeCityName(location.cityName ?? ''),
		asn: 0,
		latitude: Number(location.latitude) ?? 0,
		longitude: Number(location.longitude) ?? 0,
		network: '',
		normalizedNetwork: '',
	};
};
