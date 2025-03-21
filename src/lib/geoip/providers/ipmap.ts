import got from 'got';
import { getContinentByCountry, getRegionByCountry } from '../../location/location.js';
import type { LocationInfo } from '../client.js';
import {
	normalizeCityName,
	normalizeCityNamePublic,
} from '../utils.js';
import { getCity } from '../city-approximation.js';

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

	const originalCity = location.cityName || '';
	const originalState = location.countryCodeAlpha2 === 'US' && location.stateAnsiCode ? location.stateAnsiCode : null;
	const { city, state } = await getCity({ city: originalCity, state: originalState }, location.countryCodeAlpha2, Number(location.latitude), Number(location.longitude));

	return {
		continent: location.countryCodeAlpha2 ? getContinentByCountry(location.countryCodeAlpha2) : '',
		region: location.countryCodeAlpha2 ? getRegionByCountry(location.countryCodeAlpha2) : '',
		state,
		country: location.countryCodeAlpha2 ?? '',
		city: normalizeCityNamePublic(city),
		normalizedCity: normalizeCityName(city),
		asn: 0,
		latitude: Number(location.latitude) ?? 0,
		longitude: Number(location.longitude) ?? 0,
		network: '',
		normalizedNetwork: '',
		isProxy: null,
		isHosting: null,
		isAnycast: null,
	};
};
