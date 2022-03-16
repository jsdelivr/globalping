import _ from 'lodash';
import geoLists from 'countries-list';
import {regions} from './regions.js';

const {countries} = geoLists;
const countryToRegionMap = new Map(_.flatMap(regions, (v, r) => v.map(c => [c, r])));

export const getRegionByCountry = (country: string): string => countryToRegionMap.get(country)!;
export const getContinentByCountry = (country: string): string => countries[country as keyof typeof countries]?.continent;
