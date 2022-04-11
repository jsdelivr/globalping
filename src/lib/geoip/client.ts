import _ from 'lodash';
import anyAscii from 'any-ascii';
import type {ProbeLocation} from '../../probe/types.js';
import {scopedLogger} from '../logger.js';
import {InternalError} from '../internal-error.js';
import {ipinfoLookup} from './ipinfo.js';
import {fastlyLookup} from './fastly.js';

const logger = scopedLogger('geoip');

export type LocationInfo = Omit<ProbeLocation, 'region'>;
export const normalizeCityName = (string_: string): string => anyAscii(string_).toLowerCase();
export const normalizeNetworkName = (string_: string): string => string_.toLowerCase();

const bestMatch = (field: keyof LocationInfo, sources: LocationInfo[]): LocationInfo => {
	const ranked = Object.values(_.groupBy(sources, field)).sort((a, b) => b.length - a.length).flat();
	const best = ranked.shift();

	if (!best) {
		logger.error(`failed to find a correct value for a filed "${field}"`, {field, sources});
		throw new Error(`failed to find a correct value for a filed "${field}"`);
	}

	return best;
};

const isVpn = (client: {proxy_desc: string; proxy_type: string}): boolean => {
	if (!client) {
		return false;
	}

	if (['anonymous', 'aol', 'blackberry', 'corporate'].includes(client.proxy_type)) {
		return true;
	}

	if (client.proxy_desc.startsWith('tor-') || client.proxy_desc === 'vpn') {
		return true;
	}

	return false;
};

export const geoIpLookup = async (addr: string): Promise<LocationInfo> => {
	const results = await Promise
		.allSettled([ipinfoLookup(addr), fastlyLookup(addr)])
		.then(([ipinfo, fastly]) => {
			const fulfilled = [];

			fulfilled.push(
				ipinfo.status === 'fulfilled' ? ipinfo.value : null,
				fastly.status === 'fulfilled' ? fastly.value.locations : null,
			);

			if (fastly.status === 'fulfilled' && isVpn(fastly.value.client)) {
				throw new InternalError('vpn detected', true);
			}

			return fulfilled.filter(v => v).flat();
		}) as LocationInfo[];

	const match = bestMatch('city', results);

	return {
		continent: match.continent,
		country: match.country,
		state: match.state,
		city: match.city,
		asn: Number(match.asn),
		latitude: Number(match.latitude),
		longitude: Number(match.longitude),
		network: normalizeNetworkName(match.network),
	};
};
