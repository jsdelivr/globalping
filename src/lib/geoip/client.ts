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
import { normalizeCoordinate } from './utils.js';

type Provider = 'ipmap' | 'ip2location' | 'ipinfo' | 'maxmind' | 'fastly';
export type LocationInfo = ProbeLocation & { isProxy: boolean | null; isHosting: boolean | null; isAnycast: boolean | null };
export type ProviderLocationInfo = Omit<LocationInfo, 'allowedCountries'> & { provider: Provider };
export type NetworkInfo = {
	network: string;
	normalizedNetwork: string;
	asn: number;
};

const BLOCKED_ASNS = [
	13335, // Cloudflare
];

const logger = scopedLogger('geoip');

let geoIpClient: GeoIpClient;

export const getGeoIpClient = (): GeoIpClient => {
	if (!geoIpClient) {
		geoIpClient = new GeoIpClient(config.get('geoip.cache.enabled') ? new RedisCache(getRedisClient()) : new NullCache());
	}

	return geoIpClient;
};

export default class GeoIpClient {
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
				const fulfilled: (ProviderLocationInfo | null)[] = [];

				// Providers here are pushed in a desc prioritized order
				fulfilled.push(
					ipinfo.status === 'fulfilled' ? ipinfo.value : null,
					ip2location.status === 'fulfilled' ? ip2location.value : null,
					maxmind.status === 'fulfilled' ? maxmind.value : null,
					ipmap.status === 'fulfilled' ? ipmap.value : null,
					fastly.status === 'fulfilled' ? fastly.value : null,
				);

				return fulfilled.filter(Boolean).flat();
			}) as ProviderLocationInfo[];

		const ip2location = results.find(result => result.provider === 'ip2location');
		const ipinfo = results.find(result => result.provider === 'ipinfo');
		const resultsWithCities = results.filter(s => s.city);

		const isProxy = (ip2location?.isProxy && !isAddrWhitelisted(addr)) ?? null;

		if (isProxy) {
			throw new ProbeError(`vpn detected: ${addr}`);
		}

		if (resultsWithCities.length === 0 || (resultsWithCities.length === 1 && resultsWithCities[0]?.provider === 'fastly')) {
			throw new ProbeError(`unresolvable geoip: ${addr}`);
		}

		const [ match ] = this.bestMatch(results);
		const networkMatch = this.matchNetwork(match, results);

		if (!networkMatch) {
			throw new ProbeError(`unresolvable geoip: ${addr}`);
		}

		if (BLOCKED_ASNS.includes(Number(networkMatch.asn))) {
			throw new ProbeError(`vpn detected: ${addr}`);
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
			latitude: normalizeCoordinate(Number(match.latitude)),
			longitude: normalizeCoordinate(Number(match.longitude)),
			network: networkMatch.network,
			normalizedNetwork: networkMatch.normalizedNetwork,
			isProxy,
			isHosting,
			isAnycast,
			allowedCountries: _.uniq(results.filter(r => r.country).map(r => r.country)),
		};
	}

	private matchNetwork (best: ProviderLocationInfo, sources: ProviderLocationInfo[]): NetworkInfo | undefined {
		const match = sources.find(source => source.normalizedCity === best.normalizedCity && source?.asn && source?.network);

		if (!match) {
			return match;
		}

		// Sometimes, different sources use different casing for the same network name,
		// so returning `match` directly leads to inconsistencies. Instead, we go through
		// the sources again and pick the first one that has the correct `asn` and `normalizedNetwork`.
		// This reduces the inconsistencies as the sources are in stable order.
		return sources.find(source => source.asn === match.asn && source.normalizedNetwork === match.normalizedNetwork);
	}

	private bestMatch (sources: ProviderLocationInfo[]): [ProviderLocationInfo, ProviderLocationInfo[]] {
		const filtered = sources.filter(s => s.normalizedCity);

		// First, cluster the sources by country and select the most popular one.
		// In case of a tie (e.g., [ 2, 2, 1 ]) we fall back to the provider priority by selecting the first group (array sort is stable).
		const clusters = Object.values(_.groupBy(filtered, 'country'));
		const rankedClusters = clusters.sort((a, b) => b.length - a.length);

		// Select the most popular value within the most popular country.
		const grouped = Object.values(_.groupBy(rankedClusters[0], 'normalizedCity'));
		const ranked = grouped.sort((a, b) => b.length - a.length).flat();

		const match = ranked[0];

		if (!match || match.provider === 'fastly') {
			logger.error(`Failed to find a good match`, { sources });
			throw new Error(`failed to find a food match`);
		}

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
