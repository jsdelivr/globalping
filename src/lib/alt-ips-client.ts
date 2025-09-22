import { promisify } from 'node:util';
import { randomBytes } from 'node:crypto';
import { scopedLogger } from './logger.js';
import GeoIpClient, { getGeoIpClient } from './geoip/client.js';
import { isIpPrivate } from './private-ip.js';
import { ProbeError } from './probe-error.js';
import { isIpBlocked } from './blocked-ip-ranges.js';
import { getPersistentRedisClient, type RedisClient } from './redis/persistent-client.js';
import { Probe } from '../probe/types.js';

const getRandomBytes = promisify(randomBytes);
const logger = scopedLogger('alt-ips');

export const ALT_IP_REQ_MESSAGE_TYPE = 'alt-ip:req';
export const ALT_IP_RES_MESSAGE_TYPE = 'alt-ip:res';

export type AltIpReqBody = {
	socketId: string;
	ip: string;
	token: string;
};

export type AltIpResBody = {
	result: 'success';
	reqMessageId: string;
} | {
	result: 'probe-not-found';
	reqMessageId: string;
} | {
	result: 'invalid-alt-ip';
	reqMessageId: string;
};

export class AltIpsClient {
	ALT_IP_TOKEN_TTL = 30;

	constructor (
		private readonly redis: RedisClient,
		private readonly geoIpClient: GeoIpClient,
	) {}

	async generateToken (ip: string) {
		const bytes = await getRandomBytes(24);
		const token = bytes.toString('base64');
		await Promise.all([
			this.redis.hSet('gp:alt-ip-tokens', ip, token),
			this.redis.hExpire('gp:alt-ip-tokens', ip, this.ALT_IP_TOKEN_TTL),
		]);

		return token;
	}

	async addAltIps (probe: Probe, ipsToTokens: Record<string, string>) {
		const validIps = await this.validateTokens(Object.entries(ipsToTokens));
		await Promise.all(validIps.map(ip => this.addAltIp(probe, ip)));
		return probe.altIpAddresses;
	}

	private async validateTokens (ipsToTokens: [string, string][]) {
		const tokens = await this.redis.hmGet('gp:alt-ip-tokens', ipsToTokens.map(([ ip ]) => ip));
		const ipsWithValidTokens: string[] = [];

		for (let i = 0; i < ipsToTokens.length; i++) {
			const [ ip, token ] = ipsToTokens[i]!;

			if (tokens[i] === token) {
				ipsWithValidTokens.push(ip);
			}
		}

		return ipsWithValidTokens;
	}

	/**
	 * @returns was alt IP added.
	 */
	private async addAltIp (probe: Probe, altIp: string): Promise<void> {
		const probeInfo = { probeIp: probe.ipAddress, probeLocation: probe.location };

		if (process.env['FAKE_PROBE_IP']) {
			return;
		}

		if (isIpPrivate(altIp)) {
			logger.warn('Alt IP is private.', { altIp, ...probeInfo });
			return;
		}

		if (isIpBlocked(altIp)) {
			logger.warn('Alt IP is blocked.', { altIp, ...probeInfo });
		}

		try {
			const altIpInfo = await this.geoIpClient.lookup(altIp);

			if (!probe.location.allowedCountries.includes(altIpInfo.country)) {
				logger.warn('Alt IP country doesn\'t match the probe country.', { altIp, altIpInfo, ...probeInfo });
				return;
			}

			if (altIpInfo.isAnycast) {
				logger.warn('Alt IP is anycast.', { altIp, altIpInfo, ...probeInfo });
				return;
			}
		} catch (e) {
			if (e instanceof ProbeError) {
				logger.warn('Failed to add an alt IP.', e, { altIp, ...probeInfo });
			} else {
				logger.error('Failed to add an alt IP.', e, { altIp, ...probeInfo });
			}

			return;
		}

		if (probe.ipAddress === altIp || probe.altIpAddresses.includes(altIp)) {
			return;
		}

		probe.altIpAddresses.push(altIp);
	}
}

let altIpsClient: AltIpsClient;

export const getAltIpsClient = () => {
	if (!altIpsClient) {
		altIpsClient = new AltIpsClient(getPersistentRedisClient(), getGeoIpClient());
	}

	return altIpsClient;
};
