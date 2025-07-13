import _ from 'lodash';
import { countries } from 'countries-list';
import { regions, aliases as regionAliases } from './regions.js';
import { states } from './states.js';
import { statesIso } from './states.js';
import {
	alpha as countryAlpha,
	aliases as countryAliases,
} from './countries.js';
import { aliases as networkAliases } from './networks.js';
import { continents } from './continents.js';
import type { ProbeLocation, Tag } from '../../probe/types.js';

const countryToRegionMap = new Map(_.flatMap(regions, (v, r) => v.map(c => [ c, r ])));

export function getRegionByCountry (country: string): string;
export function getRegionByCountry (country: string | null | undefined, soft: true): string | null;

export function getRegionByCountry (country: string | null | undefined, soft?: true): string | null {
	if (!country && soft) {
		return null;
	}

	const region = countryToRegionMap.get(country!);

	if (!region) {
		throw new Error(`regions associated with a country "${country}" not found`);
	}

	return region;
}

export function getContinentByCountry (country: string): string;
export function getContinentByCountry (country: string | null | undefined, soft: true): string | null;

export function getContinentByCountry (country: string | null | undefined, soft?: true): string | null {
	if (!country && soft) {
		return null;
	}

	const countryInfo = countries[country as keyof typeof countries];

	if (!countryInfo) {
		throw new Error(`country information associated with an iso code "${country}" not found`);
	}

	return countryInfo.continent;
}

export const getStateIsoByName = (state: string): string => {
	const iso = states[state];

	if (!iso) {
		throw new Error(`iso not found ${state}`);
	}

	return iso;
};

export function getStateNameByIso (state: string): string;
export function getStateNameByIso (state: string | null | undefined, soft: true): string | null;

export function getStateNameByIso (iso: string | null | undefined, soft?: true): string | null {
	if (!iso && soft) {
		return null;
	}

	const state = _.invert(states)[iso!];

	if (!state) {
		throw new Error(`state not found ${iso}`);
	}

	return state;
}

export const getStateExtendedIsoByIso = (iso: string): string => {
	const state = statesIso[iso];

	if (!state) {
		throw new Error(`state ISO 3166-2 not found ${iso}`);
	}

	return state;
};

export function getCountryByIso (iso: string): string;
export function getCountryByIso (iso: string | null | undefined, soft: true): string | null;

export function getCountryByIso (iso: string | null | undefined, soft?: true): string | null {
	if (!iso && soft) {
		return null;
	}

	const country = countries[iso as keyof typeof countries];

	if (!country) {
		throw new Error(`country not found ${iso}`);
	}

	return country.name;
}

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

export function getContinentName (key: string): string;
export function getContinentName (key: string | null | undefined, soft: true): string | null;

export function getContinentName (key: string | null | undefined, soft?: true): string | null {
	if (!key && soft) {
		return null;
	}

	const continent = continents[key as keyof typeof continents];

	if (!continent) {
		throw new Error(`continent not found ${key}`);
	}

	return continent;
}

export const getRegionAliases = (key: string): string[] => {
	const array = regionAliases.find(n => n.includes(key.toLowerCase()));

	return array ?? [];
};

export const getIndex = (location: ProbeLocation, tags: Tag[]) => {
	// Storing the index as string[][] so each category has its exact position in the index array across all probes.
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
		location.continent ? [ getContinentName(location.continent) ] : [],
		[ location.region ],
		getRegionAliases(location.region),
		[ `as${location.asn}` ],
		tags.filter(tag => tag.type === 'system').map(tag => tag.value),
		[ location.normalizedNetwork ],
		getNetworkAliases(location.normalizedNetwork),
	].map(category => category.map(s => s.toLowerCase().replaceAll('-', ' ')));

	return index;
};

