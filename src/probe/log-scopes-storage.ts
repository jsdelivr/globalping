import { getPersistentRedisClient, type RedisClient } from '../lib/redis/persistent-client.js';
import { getIpKey } from '../lib/ws/helper/probe-ip-limit.js';

export const KNOWN_SCOPES_KEY = 'gp:log-scopes';
export const SCOPE_KEY_PREFIX = 'gp:log-scope:';
export const REPORTER_SCOPES_KEY_PREFIX = 'gp:log-scopes:reporter:';
export const SCOPE_ACTIVE_WINDOW = 864_000; // 10 days in seconds
export const SCOPE_READ_CACHE_TTL = 3_600_000; // 1 hour in ms
export const MIN_SCOPE_REPORTERS = 10;
export const SCOPE_FLEET_SHARE = 0.5;
export const MAX_SCOPES_PER_REPORTER = 64;

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
			SCOPE_ACTIVE_WINDOW,
			MAX_SCOPES_PER_REPORTER,
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
			SCOPE_ACTIVE_WINDOW,
		)));

		const totalReporters = Math.max(0, ...counts);
		const threshold = Math.max(totalReporters * SCOPE_FLEET_SHARE, MIN_SCOPE_REPORTERS);

		this.cachedScopes = knownScopes
			.filter((_, index) => counts[index]! >= threshold)
			.sort();

		this.cacheExpiresAt = Date.now() + SCOPE_READ_CACHE_TTL;

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
