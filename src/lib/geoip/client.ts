import _ from 'lodash';
import anyAscii from 'any-ascii';
import {scopedLogger} from '../logger.js';
import {InternalError} from '../internal-error.js';
import {ipinfoLookup} from './ipinfo.js';
import {fastlyLookup, FastlyBundledResponse, isFastlyBundledResponse} from './fastly.js';
import {maxmindLookup} from './maxmind.js';
import {isAddrWhitelisted} from './whitelist.js';
import type {
	LocationInfo,
	LocationInfoWithProvider,
} from './types.js';
import {
	getLocation as getCachedLocation,
	setLocation as setCachedLocation,
	setClientData as setCachedClientData,
	getLocationWithClient as getCachedLocationWithClient,
} from './cache.js';

const logger = scopedLogger('geoip');

export const normalizeCityName = (string_: string): string => anyAscii(string_).toLowerCase();
export const normalizeNetworkName = (string_: string): string => string_.toLowerCase();

const bestMatch = (field: keyof LocationInfo, sources: LocationInfoWithProvider[]): LocationInfo => {
	const ranked = Object.values(_.groupBy(sources.filter(s => s[field]), field)).sort((a, b) => b.length - a.length).flat();
	const best = ranked[0];

	if (!best) {
		logger.error(`failed to find a correct value for a filed "${field}"`, {field, sources});
		throw new Error(`failed to find a correct value for a filed "${field}"`);
	}

	return _.omit(best, 'provider');
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

export const lookupByProvider = async (
	addr: string,
	provider: string,
	fallback: (addr: string) => Promise<LocationInfo | FastlyBundledResponse>,
): Promise<LocationInfo | FastlyBundledResponse> => {
	const cached = provider === 'fastly' ? await getCachedLocationWithClient(addr, provider) : await getCachedLocation(addr, provider);

	if (cached) {
		if (!isFastlyBundledResponse(cached)) {
			return cached;
		}

		if (cached.location && cached.client) {
			return cached;
		}
	}

	const result = await fallback(addr);

	if (isFastlyBundledResponse(result)) {
		await setCachedClientData(addr, result.client);
		await setCachedLocation(addr, provider, result.location);
	} else {
		await setCachedLocation(addr, provider, result);
	}

	return result;
};

export const geoIpLookup = async (addr: string): Promise<LocationInfo> => {
	const skipVpnCheck = await isAddrWhitelisted(addr);

	const results = await Promise
		.allSettled([
			lookupByProvider(addr, 'ipinfo', ipinfoLookup),
			lookupByProvider(addr, 'fastly', fastlyLookup) as Promise<FastlyBundledResponse>,
			lookupByProvider(addr, 'maxmind', maxmindLookup),
		])
		.then(([ipinfo, fastly, maxmind]) => {
			const fulfilled = [];

			fulfilled.push(
				ipinfo.status === 'fulfilled' ? {...ipinfo.value, provider: 'ipinfo'} : null,
				fastly.status === 'fulfilled' ? {...fastly.value.location, provider: 'fastly'} : null,
				maxmind.status === 'fulfilled' ? {...maxmind.value, provider: 'maxmind'} : null,
			);

			if (fastly.status === 'fulfilled' && isVpn(fastly.value.client) && !skipVpnCheck) {
				throw new InternalError('vpn detected', true);
			}

			return fulfilled.filter(v => v).flat();
		}) as LocationInfoWithProvider[];

	const match = bestMatch('city', results);
	const maxmindMatch = results.find(result => result.provider === 'maxmind');

	return {
		continent: match.continent,
		country: match.country,
		state: match.state,
		city: match.city,
		asn: Number(maxmindMatch?.asn ?? match.asn),
		latitude: Number(match.latitude),
		longitude: Number(match.longitude),
		network: normalizeNetworkName(maxmindMatch?.network ?? match.network),
	};
};
