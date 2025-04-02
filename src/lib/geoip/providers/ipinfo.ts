import got from 'got';
import config from 'config';
import { getContinentByCountry, getRegionByCountry, getStateIsoByName } from '../../location/location.js';
import type { ProviderLocationInfo } from '../client.js';
import {
	normalizeCityName,
	normalizeCityNamePublic,
	normalizeNetworkName,
} from '../utils.js';
import { getCity } from '../city-approximation.js';

type IpinfoResponse = {
	country: string | undefined;
	city: string | undefined;
	region: string | undefined;
	org: string | undefined;
	loc: string | undefined;
	privacy?: {
		hosting: boolean;
	},
	anycast?: boolean;
};

export const ipinfoLookup = async (addr: string): Promise<ProviderLocationInfo> => {
	const result = await got(`https://ipinfo.io/${addr}`, {
		username: config.get<string>('ipinfo.apiKey'),
		timeout: { request: 5000 },
	}).json<IpinfoResponse>();

	const [ lat, lon ] = (result.loc ?? ',').split(',');
	const match = /^AS(\d+)/.exec(result.org ?? '');
	const parsedAsn = match?.[1] ? Number(match[1]) : null;
	const network = (result.org ?? '').split(' ').slice(1).join(' ');

	const originalCity = result.city || '';
	const originalState = result.country === 'US' && result.region ? getStateIsoByName(result.region) : null;
	const { city, state } = await getCity({ city: originalCity, state: originalState }, result.country, Number(lat), Number(lon));

	return {
		provider: 'ipinfo',
		continent: result.country ? getContinentByCountry(result.country) : '',
		region: result.country ? getRegionByCountry(result.country) : '',
		state,
		country: result.country ?? '',
		city: normalizeCityNamePublic(city),
		normalizedCity: normalizeCityName(city),
		asn: Number(parsedAsn),
		latitude: Number(lat),
		longitude: Number(lon),
		network,
		normalizedNetwork: normalizeNetworkName(network),
		isProxy: null,
		isHosting: result.privacy?.hosting ?? null,
		isAnycast: result.anycast ?? null,
	};
};
