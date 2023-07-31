import got from 'got';
import { getContinentByCountry } from '../../location/location.js';
import type { LocationInfo } from '../client.js';
import {
	normalizeCityName,
	normalizeCityNamePublic,
} from '../utils.js';
import { getApproximatedCity } from '../city-approximation.js';

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
	const location = result?.locations?.[0] || {};

	const approximatedCity = await getApproximatedCity(location.countryCodeAlpha2, Number(location.latitude), Number(location.longitude));

	return {
		continent: location.countryCodeAlpha2 ? getContinentByCountry(location.countryCodeAlpha2) : '',
		state: location.countryCodeAlpha2 === 'US' ? location.stateAnsiCode : undefined,
		country: location.countryCodeAlpha2 ?? '',
		city: normalizeCityNamePublic(approximatedCity ?? ''),
		normalizedCity: normalizeCityName(approximatedCity ?? ''),
		asn: 0,
		latitude: Number(location.latitude) ?? 0,
		longitude: Number(location.longitude) ?? 0,
		network: '',
		normalizedNetwork: '',
	};
};
