import _ from 'lodash';
import config from 'config';
import type {Logger} from 'winston';
import type {Appsignal} from '@appsignal/nodejs';
import type {CacheInterface} from '../cache/cache-interface.js';
import {InternalError} from '../internal-error.js';
import type {ProbeLocation} from '../../probe/types.js';
import RedisCache from '../cache/redis-cache.js';
import {getRedisClient} from '../redis/client.js';
import {scopedLogger} from '../logger.js';
import appsignal from '../appsignal.js';
import {isAddrWhitelisted} from './whitelist.js';
import {ipinfoLookup} from './providers/ipinfo.js';
import {FastlyBundledResponse, fastlyLookup} from './providers/fastly.js';
import {maxmindLookup} from './providers/maxmind.js';
import {normalizeNetworkName} from './utils.js';

export type LocationInfo = Omit<ProbeLocation, 'region'>;
export type LocationInfoWithProvider = LocationInfo & {provider: string};

export const createGeoipClient = (): GeoipClient => new GeoipClient(
	new RedisCache(getRedisClient()),
	appsignal,
	scopedLogger('geoip'),
);

export default class GeoipClient {
	constructor(
		private readonly cache: CacheInterface,
		private readonly appsignal: Appsignal,
		private readonly logger: Logger,
	) {}

	async lookup(addr: string): Promise<LocationInfo> {
		const skipVpnCheck = await isAddrWhitelisted(addr);

		const results = await Promise
			.allSettled([
				this.lookupWithCache<LocationInfo>(`geoip:ipinfo:${addr}`, async () => ipinfoLookup(addr)),
				this.lookupWithCache<FastlyBundledResponse>(`geoip:fastly:${addr}`, async () => fastlyLookup(addr)),
				this.lookupWithCache<LocationInfo>(`geoip:maxmind:${addr}`, async () => maxmindLookup(addr)),
			])
			.then(([ipinfo, fastly, maxmind]) => {
				const fulfilled = [];

				fulfilled.push(
					ipinfo.status === 'fulfilled' ? {...ipinfo.value, provider: 'ipinfo'} : null,
					fastly.status === 'fulfilled' ? {...fastly.value.location, provider: 'fastly'} : null,
					maxmind.status === 'fulfilled' ? {...maxmind.value, provider: 'maxmind'} : null,
				);

				if (fastly.status === 'fulfilled' && this.isVpn(fastly.value.client) && !skipVpnCheck) {
					throw new InternalError('vpn detected', true);
				}

				return fulfilled.filter(Boolean).flat();
			}) as LocationInfoWithProvider[];

		const match = this.bestMatch('city', results);
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

	private bestMatch(field: keyof LocationInfo, sources: LocationInfoWithProvider[]): LocationInfo {
		const ranked = Object.values(_.groupBy(sources.filter(s => s[field]), field)).sort((a, b) => b.length - a.length).flat();
		const best = ranked[0];

		if (!best) {
			this.logger.error(`failed to find a correct value for a filed "${field}"`, {field, sources});
			throw new Error(`failed to find a correct value for a filed "${field}"`);
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
			this.appsignal.tracer().sendError(new Error(error), span => {
				span.setName('geoip.cache');
				span.set('key', key);
				span.set('ttl', ttl);
			});
		});

		return info;
	}
}
