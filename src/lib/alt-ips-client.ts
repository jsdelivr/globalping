import { promisify } from 'node:util';
import { randomBytes } from 'node:crypto';
import { scopedLogger } from './logger.js';
import GeoIpClient, { getGeoIpClient } from './geoip/client.js';
import { isIpPrivate } from './private-ip.js';
import { ProbeError } from './probe-error.js';
import { isIpBlocked } from './blocked-ip-ranges.js';
import { getPersistentRedisClient, type RedisClient } from './redis/persistent-client.js';
import { Probe } from '../probe/types.js';

async function asyncFilter<T> (arr: T[], predicate: (item: T) => Promise<boolean>) {
	const results = await Promise.all(arr.map(predicate));
	return arr.filter((_, i) => results[i]);
}

const getRandomBytes = promisify(randomBytes);
const logger = scopedLogger('alt-ips');

export class AltIpsClient {
	ALT_IP_TOKEN_TTL = 60;

	constructor (
		private readonly redis: RedisClient,
		private readonly geoIpClient: GeoIpClient,
	) {}

	async generateToken (ip: string) {
		const bytes = await getRandomBytes(24);
		const token = bytes.toString('base64');
		await Promise.all([
			this.redis.hSet('gp:alt-ip-tokens', token, ip),
			this.redis.hExpire('gp:alt-ip-tokens', token, this.ALT_IP_TOKEN_TTL),
		]);

		return token;
	}

	async addAltIps (probe: Probe, ipsToTokens: Record<string, string>) {
		const validIps = await this.validateTokens(Object.entries(ipsToTokens));
		const newAltIpAddresses = await asyncFilter(validIps, ip => this.validateAltIp(probe, ip));
		probe.altIpAddresses = newAltIpAddresses;
		return {
			addedAltIps: probe.altIpAddresses,
			rejectedAltIps: Object.keys(ipsToTokens).filter(ip => !probe.altIpAddresses.includes(ip)),
		};
	}

	private async validateTokens (ipsToTokens: [string, string][]) {
		if (ipsToTokens.length === 0) {
			return [];
		}

		const ips = await this.redis.hmGet('gp:alt-ip-tokens', ipsToTokens.map(([ , token ]) => token));
		const ipsWithValidTokens: string[] = [];

		for (let i = 0; i < ipsToTokens.length; i++) {
			const [ ip ] = ipsToTokens[i]!;

			if (ips[i] === ip) {
				ipsWithValidTokens.push(ip);
			}
		}

		return ipsWithValidTokens;
	}

	private async validateAltIp (probe: Probe, altIp: string): Promise<boolean> {
		const probeInfo = { probeIp: probe.ipAddress, probeLocation: probe.location };

		if (process.env['FAKE_PROBE_IP']) {
			return false;
		}

		if (isIpPrivate(altIp)) {
			logger.warn('Alt IP is private.', { altIp, ...probeInfo });
			return false;
		}

		if (isIpBlocked(altIp)) {
			logger.warn('Alt IP is blocked.', { altIp, ...probeInfo });
			return false;
		}

		try {
			const altIpInfo = await this.geoIpClient.lookup(altIp);

			if (!probe.location.allowedCountries.includes(altIpInfo.country)) {
				logger.warn('Alt IP country doesn\'t match the probe country.', { altIp, altIpInfo, ...probeInfo });
				return false;
			}

			if (altIpInfo.isAnycast) {
				logger.warn('Alt IP is anycast.', { altIp, altIpInfo, ...probeInfo });
				return false;
			}
		} catch (e) {
			if (e instanceof ProbeError) {
				logger.warn('Failed to add an alt IP.', e, { altIp, ...probeInfo });
			} else {
				logger.error('Failed to add an alt IP.', e, { altIp, ...probeInfo });
			}

			return false;
		}

		if (probe.ipAddress === altIp) {
			return false;
		}

		return true;
	}
}

let altIpsClient: AltIpsClient;

export const getAltIpsClient = () => {
	if (!altIpsClient) {
		altIpsClient = new AltIpsClient(getPersistentRedisClient(), getGeoIpClient());
	}

	return altIpsClient;
};
