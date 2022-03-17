import _ from 'lodash';
import geoLists from 'countries-list';
import {regions} from './regions.js';

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
