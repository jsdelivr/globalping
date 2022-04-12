import _ from 'lodash';
import geoLists from 'countries-list';
import {regions} from './regions.js';
import {states} from './states.js';

const {countries} = geoLists;
const countryToRegionMap = new Map(_.flatMap(regions, (v, r) => v.map(c => [c, r])));

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
	const stateEntries = Object.entries(states).find(s => s[1] === state);

	if (!stateEntries) {
		throw new Error(`state not found ${state}`);
	}

	return String(stateEntries[0]);
};

export const getStateNameByIso = (iso: string): string => {
	const state = states[iso as keyof typeof states];

	if (!state) {
		throw new Error(`state not found ${iso}`);
	}

	return state;
};
