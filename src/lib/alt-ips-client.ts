import { promisify } from 'node:util';
import { randomBytes } from 'node:crypto';
import _ from 'lodash';
import { scopedLogger } from './logger.js';
import GeoIpClient, { getGeoIpClient } from './geoip/client.js';
import { isIpPrivate } from './private-ip.js';
import { ProbeError } from './probe-error.js';
import { isIpBlocked } from './blocked-ip-ranges.js';
import { getPersistentRedisClient, type RedisClient } from './redis/persistent-client.js';
import { Probe } from '../probe/types.js';

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

	async addAltIps (probe: Probe, ipsToTokens: [string, string][]) {
		const { ipsWithValidTokens, tokenErrors } = await this.validateTokens(ipsToTokens, probe);
		const { altIpAddresses, ipErrors } = await this.validateIps(ipsWithValidTokens, probe);
		probe.altIpAddresses = altIpAddresses;
		return {
			addedAltIps: probe.altIpAddresses,
			rejectedIpsToReasons: { ...tokenErrors, ...ipErrors },
		};
	}

	private async validateTokens (ipsToTokens: [string, string][], probe: Probe) {
		if (ipsToTokens.length === 0) {
			return { ipsWithValidTokens: [], tokenErrors: {} };
		}

		const ips = await this.redis.hmGet('gp:alt-ip-tokens', ipsToTokens.map(([ , token ]) => token));
		const ipsWithValidTokens: string[] = [];
		const tokenErrors: Record<string, string> = {};

		for (let i = 0; i < ipsToTokens.length; i++) {
			const [ ip ] = ipsToTokens[i]!;

			if (ips[i] === ip) {
				ipsWithValidTokens.push(ip);
			} else {
				tokenErrors[ip] = 'Invalid alt IP token.';
				const probeInfo = { probeIp: probe.ipAddress, probeLocation: probe.location };
				logger.warn('Invalid alt IP token.', { ipToToken: ipsToTokens[i]!, ...probeInfo });
			}
		}

		return { ipsWithValidTokens: _.uniq(ipsWithValidTokens), tokenErrors };
	}

	private async validateIps (ips: string[], probe: Probe) {
		const altIpAddresses: string[] = [];
		const ipErrors: Record<string, string> = {};
		const results = await Promise.all(ips.map(ip => this.validateAltIp(probe, ip)));

		results.forEach((result, i) => {
			if (result.isValid) {
				altIpAddresses.push(ips[i]!);
			} else {
				ipErrors[ips[i]!] = result.reason;
			}
		});

		return { altIpAddresses, ipErrors };
	}

	private async validateAltIp (probe: Probe, altIp: string): Promise<{ isValid: true } | { isValid: false; reason: string }> {
		const probeInfo = { probeIp: probe.ipAddress, probeLocation: probe.location };

		if (process.env['FAKE_PROBE_IP']) {
			return { isValid: false, reason: 'FAKE_PROBE_IP is set.' };
		}

		if (isIpPrivate(altIp)) {
			logger.warn('Alt IP is private.', { altIp, ...probeInfo });
			return { isValid: false, reason: 'Alt IP is private.' };
		}

		if (isIpBlocked(altIp)) {
			logger.warn('Alt IP is blocked.', { altIp, ...probeInfo });
			return { isValid: false, reason: 'Alt IP is blocked.' };
		}

		try {
			const altIpInfo = await this.geoIpClient.lookup(altIp);

			if (!altIpInfo.allowedCountries.includes(probe.location.country)) {
				logger.warn('Alt IP country doesn\'t match the probe country.', { altIp, altIpInfo, ...probeInfo });
				return { isValid: false, reason: 'Alt IP country doesn\'t match the probe country.' };
			}

			if (altIpInfo.isAnycast) {
				logger.warn('Alt IP is anycast.', { altIp, altIpInfo, ...probeInfo });
				return { isValid: false, reason: 'Alt IP is anycast.' };
			}
		} catch (e) {
			if (e instanceof ProbeError) {
				logger.warn('Failed to add an alt IP.', e, { altIp, ...probeInfo });
			} else {
				logger.error('Failed to add an alt IP.', e, { altIp, ...probeInfo });
			}

			return { isValid: false, reason: 'Failed to add an alt IP.' };
		}

		if (probe.ipAddress === altIp) {
			return { isValid: false, reason: 'Alt IP is the same as the probe IP.' };
		}

		return { isValid: true };
	}
}

let altIpsClient: AltIpsClient;

export const getAltIpsClient = () => {
	if (!altIpsClient) {
		altIpsClient = new AltIpsClient(getPersistentRedisClient(), getGeoIpClient());
	}

	return altIpsClient;
};
