import got from 'got';
import config from 'config';
import { getContinentByCountry, getStateIsoByName } from '../../location/location.js';
import type { LocationInfo } from '../client.js';
import {
	normalizeCityName,
	normalizeCityNamePublic,
	normalizeNetworkName,
} from '../utils.js';
import { getApproximatedCity } from '../city-approximation.js';

type IpinfoResponse = {
	country: string | undefined;
	city: string | undefined;
	region: string | undefined;
	org: string | undefined;
	loc: string | undefined;
};

export const ipinfoLookup = async (addr: string): Promise<LocationInfo> => {
	const result = await got(`https://ipinfo.io/${addr}`, {
		username: config.get<string>('ipinfo.apiKey'),
		timeout: { request: 5000 },
	}).json<IpinfoResponse>();

	const [ lat, lon ] = (result.loc ?? ',').split(',');
	const match = /^AS(\d+)/.exec(result.org ?? '');
	const parsedAsn = match?.[1] ? Number(match[1]) : null;
	const network = (result.org ?? '').split(' ').slice(1).join(' ');

	const approximatedCity = await getApproximatedCity(result.country, Number(lat), Number(lon));

	return {
		continent: result.country ? getContinentByCountry(result.country) : '',
		state: result.country === 'US' && result.region ? getStateIsoByName(result.region) : undefined,
		country: result.country ?? '',
		city: normalizeCityNamePublic(approximatedCity ?? ''),
		normalizedCity: normalizeCityName(approximatedCity ?? ''),
		asn: Number(parsedAsn),
		latitude: Number(lat),
		longitude: Number(lon),
		network,
		normalizedNetwork: normalizeNetworkName(network),
	};
};
