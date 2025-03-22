import _ from 'lodash';
import { countries } from 'countries-list';
import { regions, aliases as regionAliases } from './regions.js';
import { states } from './states.js';
import { statesIso } from './states-iso.js';
import {
	alpha as countryAlpha,
	aliases as countryAliases,
} from './countries.js';
import { aliases as networkAliases } from './networks.js';
import { aliases as continentAliases } from './continents.js';
import type { ProbeLocation, Tag } from '../../probe/types.js';

const countryToRegionMap = new Map(_.flatMap(regions, (v, r) => v.map(c => [ c, r ])));

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
		throw new Error(`country information associated with an iso code "${country}" not found`);
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

export const getStateExtendedIsoByIso = (iso: string): string => {
	const state = statesIso[iso];

	if (!state) {
		throw new Error(`state ISO 3166-2 not found ${iso}`);
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

export const getContinentAliases = (key: string): string[] => {
	const array = continentAliases.find(n => n.includes(key.toLowerCase()));

	return array ?? [];
};

export const getRegionAliases = (key: string): string[] => {
	const array = regionAliases.find(n => n.includes(key.toLowerCase()));

	return array ?? [];
};

export const getIndex = (location: ProbeLocation, tags: Tag[]) => {
	// Storing index as string[][] so every category will have it's exact position in the index array across all probes
	const index = [
		[ location.country ],
		[ getCountryIso3ByIso2(location.country) ],
		[ getCountryByIso(location.country) ],
		getCountryAliases(location.country),
		[ location.normalizedCity ],
		location.state ? [ location.state ] : [],
		location.state ? [ getStateExtendedIsoByIso(location.state) ] : [],
		location.state ? [ getStateNameByIso(location.state) ] : [],
		[ location.continent ],
		getContinentAliases(location.continent),
		[ location.region ],
		getRegionAliases(location.region),
		[ `as${location.asn}` ],
		tags.filter(tag => tag.type === 'system').map(tag => tag.value),
		[ location.normalizedNetwork ],
		getNetworkAliases(location.normalizedNetwork),
	].map(category => category.map(s => s.toLowerCase().replaceAll('-', ' ')));

	return index;
};

