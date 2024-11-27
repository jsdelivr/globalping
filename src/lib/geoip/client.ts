import _ from 'lodash';
import config from 'config';
import type { CacheInterface } from '../cache/cache-interface.js';
import { ProbeError } from '../probe-error.js';
import type { ProbeLocation } from '../../probe/types.js';
import RedisCache from '../cache/redis-cache.js';
import { getRedisClient } from '../redis/client.js';
import { scopedLogger } from '../logger.js';
import { isAddrWhitelisted } from './whitelist.js';
import { ipinfoLookup } from './providers/ipinfo.js';
import { fastlyLookup } from './providers/fastly.js';
import { maxmindLookup } from './providers/maxmind.js';
import { ipmapLookup } from './providers/ipmap.js';
import { ip2LocationLookup } from './providers/ip2location.js';
import { isHostingOverrides } from './overrides.js';
import NullCache from '../cache/null-cache.js';

type Provider = 'ipmap' | 'ip2location' | 'ipinfo' | 'maxmind' | 'fastly';
export type LocationInfo = ProbeLocation & {isProxy: boolean | null, isHosting: boolean | null, isAnycast: boolean | null};
export type LocationInfoWithProvider = LocationInfo & {provider: Provider};
export type NetworkInfo = {
	network: string;
	normalizedNetwork: string;
	asn: number;
};

const logger = scopedLogger('geoip');

export const createGeoipClient = (): GeoipClient => {
	return new GeoipClient(config.get('geoip.cache.enabled') ? new RedisCache(getRedisClient()) : new NullCache());
};

export default class GeoipClient {
	constructor (private readonly cache: CacheInterface) {}

	async lookup (addr: string): Promise<LocationInfo> {
		const results = await Promise
			.allSettled([
				this.lookupWithCache(`geoip:ipinfo:${addr}`, async () => ipinfoLookup(addr)),
				this.lookupWithCache(`geoip:ip2location:${addr}`, async () => ip2LocationLookup(addr)),
				this.lookupWithCache(`geoip:maxmind:${addr}`, async () => maxmindLookup(addr)),
				this.lookupWithCache(`geoip:ipmap:${addr}`, async () => ipmapLookup(addr)),
				this.lookupWithCache(`geoip:fastly:${addr}`, async () => fastlyLookup(addr)),
			])
			.then(([ ipinfo, ip2location, maxmind, ipmap, fastly ]) => {
				const fulfilled: (LocationInfoWithProvider | null)[] = [];

				// Providers here are pushed in a desc prioritized order
				fulfilled.push(
					ipinfo.status === 'fulfilled' ? { ...ipinfo.value, provider: 'ipinfo' } : null,
					ip2location.status === 'fulfilled' ? { ...ip2location.value, provider: 'ip2location' } : null,
					maxmind.status === 'fulfilled' ? { ...maxmind.value, provider: 'maxmind' } : null,
					ipmap.status === 'fulfilled' ? { ...ipmap.value, provider: 'ipmap' } : null,
					fastly.status === 'fulfilled' ? { ...fastly.value, provider: 'fastly' } : null,
				);

				return fulfilled.filter(Boolean).flat();
			}) as LocationInfoWithProvider[];

		const ip2location = results.find(result => result.provider === 'ip2location');
		const ipinfo = results.find(result => result.provider === 'ipinfo');
		const resultsWithCities = results.filter(s => s.city);


		const isProxy = (ip2location?.isProxy && !isAddrWhitelisted(addr)) ?? null;

		if (isProxy) {
			throw new ProbeError('vpn detected');
		}

		if (resultsWithCities.length === 0 || (resultsWithCities.length === 1 && resultsWithCities[0]?.provider === 'fastly')) {
			throw new ProbeError(`unresolvable geoip: ${addr}`);
		}

		const [ match, ranked ] = this.bestMatch('normalizedCity', results);
		const networkMatch = this.matchNetwork(match, ranked);

		if (!networkMatch) {
			throw new ProbeError(`unresolvable geoip: ${addr}`);
		}

		let isHosting = ip2location?.isHosting ?? null;

		for (const override of isHostingOverrides) {
			if (override.normalizedNetwork.test(networkMatch.normalizedNetwork)) {
				isHosting = override.isHosting;
				break;
			}
		}

		const isAnycast = ipinfo?.isAnycast ?? null;

		return {
			continent: match.continent,
			country: match.country,
			state: match.state,
			city: match.city,
			region: match.region,
			normalizedCity: match.normalizedCity,
			asn: Number(networkMatch.asn),
			latitude: Math.round(Number(match.latitude) * 100) / 100,
			longitude: Math.round(Number(match.longitude) * 100) / 100,
			network: networkMatch.network,
			normalizedNetwork: networkMatch.normalizedNetwork,
			isProxy,
			isHosting,
			isAnycast,
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
		const filtered = sources.filter(s => s[field]);
		// Group sources by the same field value
		const grouped = Object.values(_.groupBy(filtered, field));
		const ranked = grouped.sort((a, b) => b.length - a.length).flat();

		const best = ranked[0];

		if (!best || best.provider === 'fastly') {
			logger.error(`failed to find a correct value for a field "${field}"`, { field, sources });
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

		await this.cache.set(key, info, ttl);

		return info;
	}
}
