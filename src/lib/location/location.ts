import _ from 'lodash';
import geoLists from 'countries-list';
import { regions } from './regions.js';
import { states } from './states.js';
import {
	alpha as countryAlpha,
	aliases as countryAliases,
} from './countries.js';
import { aliases as networkAliases } from './networks.js';

const { countries } = geoLists;
const countryToRegionMap = new Map(_.flatMap(regions, (v, r) => v.map(c => [ c, r.replace(/-/g, ' ') ])));

export const getRegionByCountry = (country: string): string => {
	const region = countryToRegionMap.get(country);

	if (!region) {
		throw new Error(`regions associated with a country "${country}" not found`);
	}

	return region;
};

export const getContinentByCountry = (country: string): string => {
	const countryInfo = countries[country as keyof typeof countries];

	if (!countryInfo) {
		throw new Error(`country information associated with a iso code "${country}" not found`);
	}

	return countryInfo.continent;
};

export const getStateIsoByName = (state: string): string => {
	const iso = states[state];

	if (!iso) {
		throw new Error(`iso not found ${state}`);
	}

	return iso;
};

export const getStateNameByIso = (iso: string): string => {
	const state = _.invert(states)[iso];

	if (!state) {
		throw new Error(`state not found ${iso}`);
	}

	return state;
};

export const getCountryByIso = (iso: string): string => {
	const country = countries[iso as keyof typeof countries];

	if (!country) {
		throw new Error(`country not found ${iso}`);
	}

	return country.name;
};

export const getCountryIso3ByIso2 = (iso: string): string => {
	const iso3 = countryAlpha[iso as keyof typeof countryAlpha];

	if (!iso3) {
		throw new Error(`iso3 not found ${iso}`);
	}

	return iso3;
};

export const getCountryAliases = (key: string): string[] => {
	const array = countryAliases.find(n => n.includes(key.toLowerCase()));

	return array ?? [];
};

export const getNetworkAliases = (key: string): string[] => {
	const array = networkAliases.find(n => n.includes(key.toLowerCase()));

	return array ?? [];
};
