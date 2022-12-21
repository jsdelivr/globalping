import _ from 'lodash';
import config from 'config';
import type {Logger} from 'winston';
import newrelic from 'newrelic';
import type {CacheInterface} from '../cache/cache-interface.js';
import {InternalError} from '../internal-error.js';
import type {ProbeLocation} from '../../probe/types.js';
import RedisCache from '../cache/redis-cache.js';
import {getRedisClient} from '../redis/client.js';
import {scopedLogger} from '../logger.js';
import {getRegionByCountry} from '../location/location.js';
import {isAddrWhitelisted} from './whitelist.js';
import {ipinfoLookup} from './providers/ipinfo.js';
import {type FastlyBundledResponse, fastlyLookup} from './providers/fastly.js';
import {maxmindLookup} from './providers/maxmind.js';
import {prettifyRegionName} from './utils.js';

export type LocationInfo = Omit<ProbeLocation, 'region' | 'normalizedRegion'>;
export type LocationInfoWithProvider = LocationInfo & {provider: string};
export type RegionInfo = {
	region: string;
	normalizedRegion: string;
};
export type NetworkInfo = {
	network: string;
	normalizedNetwork: string;
	asn: number;
};

export const createGeoipClient = (): GeoipClient => new GeoipClient(
	new RedisCache(getRedisClient()),
	scopedLogger('geoip'),
);

export default class GeoipClient {
	constructor(
		private readonly cache: CacheInterface,
		private readonly logger: Logger,
	) {}

	async lookup(addr: string): Promise<ProbeLocation> {
		const results = await Promise
			.allSettled([
				this.lookupWithCache<LocationInfo>(`geoip:ipinfo:${addr}`, async () => ipinfoLookup(addr)),
				this.lookupWithCache<LocationInfo>(`geoip:maxmind:${addr}`, async () => maxmindLookup(addr)),
				this.lookupWithCache<FastlyBundledResponse>(`geoip:fastly:${addr}`, async () => fastlyLookup(addr)),
			])
			.then(([ipinfo, maxmind, fastly]) => {
				const fulfilled = [];

				fulfilled.push(
					ipinfo.status === 'fulfilled' ? {...ipinfo.value, provider: 'ipinfo'} : null,
					maxmind.status === 'fulfilled' ? {...maxmind.value, provider: 'maxmind'} : null,
					fastly.status === 'fulfilled' ? {...fastly.value.location, provider: 'fastly'} : null,
				);

				if (fastly.status === 'fulfilled' && this.isVpn(fastly.value.client) && !isAddrWhitelisted(addr)) {
					throw new InternalError('vpn detected', true);
				}

				return fulfilled.filter(Boolean).flat();
			}) as LocationInfoWithProvider[];

		const resultsWithCities = results.filter(s => s.city);

		if (resultsWithCities.length < 2 && resultsWithCities[0]?.provider === 'fastly') {
			throw new InternalError(`unresolvable geoip: ${addr}`, true);
		}

		const match = this.bestMatch('normalizedCity', results);
		const networkMatch = this.matchNetwork(match, results);

		if (!networkMatch) {
			throw new InternalError(`unresolvable geoip: ${addr}`, true);
		}

		const region = this.matchRegion(match);

		return {
			continent: match.continent,
			country: match.country,
			state: match.state,
			city: match.city,
			region: region.region,
			normalizedRegion: region.normalizedRegion,
			normalizedCity: match.normalizedCity,
			asn: Number(networkMatch.asn),
			latitude: Number(match.latitude),
			longitude: Number(match.longitude),
			network: networkMatch.network,
			normalizedNetwork: networkMatch.normalizedNetwork,
		};
	}

	private isVpn(client: {proxy_desc: string; proxy_type: string}): boolean {
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
	}

	private matchRegion(best: LocationInfo): RegionInfo {
		const region = getRegionByCountry(best.country);

		return {
			region: prettifyRegionName(region),
			normalizedRegion: region,
		};
	}

	private matchNetwork(best: LocationInfo, sources: LocationInfoWithProvider[]): NetworkInfo | undefined {
		if (best.asn && best.network) {
			return {
				asn: best.asn,
				network: best.network,
				normalizedNetwork: best.normalizedNetwork,
			};
		}

		const maxmind = sources.find(s => s.provider === 'maxmind' && s.city === best.city);
		if (maxmind?.asn && maxmind?.network) {
			return {
				asn: maxmind.asn,
				network: maxmind.network,
				normalizedNetwork: maxmind.normalizedNetwork,
			};
		}

		return undefined;
	}

	private bestMatch(field: keyof LocationInfo, sources: LocationInfoWithProvider[]): LocationInfo {
		const filtered = sources.filter(s => s[field]);
		// Group by the same field value
		const grouped = Object.values(_.groupBy(filtered, field));
		// Move items with the same values to the beginning
		const ranked = grouped.sort((a, b) => b.length - a.length).flat();

		let best = ranked[0];

		// If all values are different
		if (grouped.length === filtered.length) {
			const sourcesObject = Object.fromEntries(filtered.map(s => [s.provider, s]));
			best = sourcesObject['ipinfo'] ?? sourcesObject['maxmind'];
		}

		if (!best || best.provider === 'fastly') {
			this.logger.error(`failed to find a correct value for a field "${field}"`, {field, sources});
			throw new Error(`failed to find a correct value for a field "${field}"`);
		}

		return _.omit(best, 'provider');
	}

	private async lookupWithCache<T>(key: string, fn: () => Promise<T>): Promise<T> {
		const cached = await this.cache.get<T>(key);

		if (cached) {
			return cached;
		}

		const info = await fn();
		const ttl = Number(config.get('geoip.cache.ttl'));

		await this.cache.set(key, info, ttl).catch(error => {
			this.logger.error('Failed to cache geoip info for probe.', error);
			newrelic.noticeError(error, {key, ttl});
		});

		return info;
	}
}
