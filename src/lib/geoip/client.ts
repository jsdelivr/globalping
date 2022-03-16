import _ from 'lodash';
import anyAscii from 'any-ascii';
import type {ProbeLocation} from '../../probe/types.js';
import {ipinfoLookup} from './ipinfo.js';
import {fastlyLookup} from './fastly.js';

export type LocationInfo = Omit<ProbeLocation, 'region'>;
export const normalizeCityName = (string_: string): string => anyAscii(string_).toLowerCase();

const bestMatch = (field: keyof LocationInfo, sources: LocationInfo[]): LocationInfo => {
	const ranked = _.flatMap(Object.fromEntries(_.orderBy(_.entries(_.groupBy(sources, field)), ([, v]) => v.length, 'desc')));

	return ranked[0]!;
};

export const geoIpLookup = async (addr: string): Promise<LocationInfo> => {
	const results = await Promise
		.allSettled([ipinfoLookup(addr), fastlyLookup(addr)])
		.then(([ipinfo, fastly]) => {
			const fulfilled = [];

			fulfilled.push(
				ipinfo.status === 'fulfilled' ? ipinfo.value : null,
				fastly.status === 'fulfilled' ? fastly.value : null,
			);

			return fulfilled.filter(v => v !== null).flat();
		}) as LocationInfo[];

	return {
		continent: bestMatch('continent', results).continent,
		country: bestMatch('country', results).country,
		state: bestMatch('state', results).state,
		city: bestMatch('city', results).city,
		asn: Number(bestMatch('asn', results).asn),
		latitude: Number(bestMatch('city', results).latitude),
		longitude: Number(bestMatch('city', results).longitude),
	};
};
