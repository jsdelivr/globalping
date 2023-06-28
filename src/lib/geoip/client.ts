import _ from 'lodash';
import config from 'config';
import type { Logger } from 'winston';
import newrelic from 'newrelic';
import type { CacheInterface } from '../cache/cache-interface.js';
import { InternalError } from '../internal-error.js';
import type { ProbeLocation } from '../../probe/types.js';
import RedisCache from '../cache/redis-cache.js';
import { getRedisClient } from '../redis/client.js';
import { scopedLogger } from '../logger.js';
import { getRegionByCountry } from '../location/location.js';
import { isAddrWhitelisted } from './whitelist.js';
import { ipinfoLookup } from './providers/ipinfo.js';
import { type FastlyBundledResponse, fastlyLookup } from './providers/fastly.js';
import { maxmindLookup } from './providers/maxmind.js';
import { ipmapLookup } from './providers/ipmap.js';
import { ip2LocationLookup } from './providers/ip2location.js';
import { normalizeRegionName } from './utils.js';

export type LocationInfo = Omit<ProbeLocation, 'region' | 'normalizedRegion'>;
type Provider = 'ipmap' | 'ip2location' | 'ipinfo' | 'maxmind' | 'fastly';
export type LocationInfoWithProvider = LocationInfo & {provider: Provider};
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
	constructor (
		private readonly cache: CacheInterface,
		private readonly logger: Logger,
	) {}

	async lookup (addr: string): Promise<ProbeLocation> {
		const results = await Promise
			.allSettled([
				this.lookupWithCache<LocationInfo>(`geoip:ip2location:${addr}`, async () => ip2LocationLookup(addr)),
				this.lookupWithCache<LocationInfo>(`geoip:ipmap:${addr}`, async () => ipmapLookup(addr)),
				this.lookupWithCache<LocationInfo>(`geoip:maxmind:${addr}`, async () => maxmindLookup(addr)),
				this.lookupWithCache<LocationInfo>(`geoip:ipinfo:${addr}`, async () => ipinfoLookup(addr)),
				this.lookupWithCache<FastlyBundledResponse>(`geoip:fastly:${addr}`, async () => fastlyLookup(addr)),
			])
			.then(([ ip2location, ipmap, maxmind, ipinfo, fastly ]) => {
				const fulfilled: (LocationInfoWithProvider | null)[] = [];

				fulfilled.push(
					ip2location.status === 'fulfilled' ? { ...ip2location.value, provider: 'ip2location' } : null,
					ipmap.status === 'fulfilled' ? { ...ipmap.value, provider: 'ipmap' } : null,
					maxmind.status === 'fulfilled' ? { ...maxmind.value, provider: 'maxmind' } : null,
					ipinfo.status === 'fulfilled' ? { ...ipinfo.value, provider: 'ipinfo' } : null,
					fastly.status === 'fulfilled' ? { ...fastly.value.location, provider: 'fastly' } : null,
				);

				if (fastly.status === 'fulfilled' && this.isVpn(fastly.value.client) && !isAddrWhitelisted(addr)) {
					throw new InternalError('vpn detected', true);
				}

				return fulfilled.filter(Boolean).flat();
			}) as LocationInfoWithProvider[];

		const resultsWithCities = results.filter(s => s.city);

		if (resultsWithCities.length === 0 || (resultsWithCities.length === 1 && resultsWithCities[0]?.provider === 'fastly')) {
			throw new InternalError(`unresolvable geoip: ${addr}`, true);
		}

		const [ match, ranked ] = this.bestMatch('normalizedCity', results);
		const networkMatch = this.matchNetwork(match, ranked);

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

	private isVpn (client: {proxy_desc: string; proxy_type: string}): boolean {
		if (!client) {
			return false;
		}

		if ([ 'anonymous', 'aol', 'blackberry', 'corporate' ].includes(client.proxy_type)) {
			return true;
		}

		if (client.proxy_desc.startsWith('tor-') || client.proxy_desc === 'vpn') {
			return true;
		}

		return false;
	}

	private matchRegion (best: LocationInfo): RegionInfo {
		const region = getRegionByCountry(best.country);

		return {
			region,
			normalizedRegion: normalizeRegionName(region),
		};
	}

	private matchNetwork (best: LocationInfo, rankedSources: LocationInfoWithProvider[]): NetworkInfo | undefined {
		if (best.asn && best.network) {
			return {
				asn: best.asn,
				network: best.network,
				normalizedNetwork: best.normalizedNetwork,
			};
		}

		for (const source of rankedSources) {
			if (source.normalizedCity === best.normalizedCity && source?.asn && source?.network) {
				return {
					asn: source.asn,
					network: source.network,
					normalizedNetwork: source.normalizedNetwork,
				};
			}
		}

		return undefined;
	}

	private bestMatch (field: keyof LocationInfo, sources: LocationInfoWithProvider[]): [LocationInfo, LocationInfoWithProvider[]] {
		const DESC_PRIORITY_OF_PROVIDERS: Provider[] = [ 'ip2location', 'ipmap', 'maxmind', 'ipinfo', 'fastly' ];
		const filtered = sources.filter(s => s[field]);
		// Initially sort sources so they are sorted inside groups
		const sorted = filtered.sort((sourceA, sourceB) => {
			const indexSourceA = DESC_PRIORITY_OF_PROVIDERS.indexOf(sourceA.provider);
			const indexSourceB = DESC_PRIORITY_OF_PROVIDERS.indexOf(sourceB.provider);
			return indexSourceA - indexSourceB;
		});
		// Group sources by the same field value
		const grouped = Object.values(_.groupBy(sorted, field));
		const ranked = grouped.sort((sourcesA, sourcesB) => {
			// Move bigger groups to the beginning
			const groupsSizeDiff = sourcesB.length - sourcesA.length;

			if (groupsSizeDiff === 0) {
				// If group sizes are equal move the group with the prioritized item to the beginning
				const smallestIndexSourceA = DESC_PRIORITY_OF_PROVIDERS.indexOf(sourcesA[0]!.provider);
				const smallestIndexSourceB = DESC_PRIORITY_OF_PROVIDERS.indexOf(sourcesB[0]!.provider);
				return smallestIndexSourceA - smallestIndexSourceB;
			}

			return groupsSizeDiff;
		}).flat();

		const best = ranked[0];

		if (!best || best.provider === 'fastly') {
			this.logger.error(`failed to find a correct value for a field "${field}"`, { field, sources });
			throw new Error(`failed to find a correct value for a field "${field}"`);
		}

		const match = _.omit(best, 'provider');
		return [ match, ranked ];
	}

	public async lookupWithCache<T> (key: string, fn: () => Promise<T>): Promise<T> {
		const cached = await this.cache.get<T>(key);

		if (cached) {
			return cached;
		}

		const info = await fn();
		const ttl = Number(config.get('geoip.cache.ttl'));

		await this.cache.set(key, info, ttl).catch((error: Error) => {
			this.logger.error('Failed to cache geoip info for probe.', error);
			newrelic.noticeError(error, { key, ttl });
		});

		return info;
	}
}
