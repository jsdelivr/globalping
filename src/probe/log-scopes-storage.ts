import config from 'config';
import { getPersistentRedisClient, type RedisClient } from '../lib/redis/persistent-client.js';
import { getIpKey } from '../lib/ws/helper/probe-ip-limit.js';

export const KNOWN_SCOPES_KEY = 'gp:log-scopes';
export const SCOPE_KEY_PREFIX = 'gp:log-scope:';
export const REPORTER_SCOPES_KEY_PREFIX = 'gp:log-scopes:reporter:';
export const scopeActiveWindow = config.get<number>('probeLogScopes.activeWindow');
export const scopeReadCacheTtl = config.get<number>('probeLogScopes.readCacheTtl');
export const minScopeReporters = config.get<number>('probeLogScopes.minReporters');
export const scopeFleetShare = config.get<number>('probeLogScopes.fleetShare');
export const maxScopesPerReporter = config.get<number>('probeLogScopes.maxScopesPerReporter');

export class ProbeLogScopesStorage {
	private cachedScopes: string[] | undefined;
	private cacheExpiresAt = 0;

	constructor (private readonly redis: RedisClient) {}

	async writeScopes (ipAddress: string, scopes: string[]): Promise<boolean> {
		const uniqueScopes = [ ...new Set(scopes) ];

		if (uniqueScopes.length === 0) {
			return true;
		}

		const reporterIdentity = getIpKey(ipAddress);
		const scopeKeys = uniqueScopes.map(scope => `${SCOPE_KEY_PREFIX}${scope}`);

		// Keep the reporter cap, forward indexes, and known-scope publication atomic across concurrent reports and reads.
		return this.redis.registerProbeLogScopes(
			`${REPORTER_SCOPES_KEY_PREFIX}${reporterIdentity}`,
			KNOWN_SCOPES_KEY,
			scopeKeys,
			reporterIdentity,
			scopeActiveWindow,
			maxScopesPerReporter,
			minScopeReporters,
			uniqueScopes,
		);
	}

	async readScopes (): Promise<string[]> {
		if (this.cachedScopes !== undefined && Date.now() < this.cacheExpiresAt) {
			return this.cachedScopes;
		}

		const knownScopes = await this.redis.sMembers(KNOWN_SCOPES_KEY);

		const counts = await Promise.all(knownScopes.map(scope => this.redis.countProbeLogScopeReporters(
			KNOWN_SCOPES_KEY,
			`${SCOPE_KEY_PREFIX}${scope}`,
			scope,
			scopeActiveWindow,
			minScopeReporters,
		)));

		const totalReporters = counts.reduce((max, count) => Math.max(max, count), 0);
		const threshold = Math.max(totalReporters * scopeFleetShare, minScopeReporters);

		this.cachedScopes = knownScopes
			.filter((_, index) => counts[index]! >= threshold)
			.sort();

		this.cacheExpiresAt = Date.now() + scopeReadCacheTtl;

		return this.cachedScopes;
	}
}

let probeLogScopesStorage: ProbeLogScopesStorage;

export const getProbeLogScopesStorage = () => {
	if (!probeLogScopesStorage) {
		probeLogScopesStorage = new ProbeLogScopesStorage(getPersistentRedisClient());
	}

	return probeLogScopesStorage;
};
