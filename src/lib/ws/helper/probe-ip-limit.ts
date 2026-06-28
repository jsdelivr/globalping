import config from 'config';
import ipaddr from 'ipaddr.js';
import { LRUCache } from 'lru-cache';
import { scopedLogger } from '../../logger.js';
import { ProbeError } from '../../probe-error.js';
import type { ServerProbe, SocketProbe } from '../../../probe/types.js';
import type { IoContext } from '../../server.js';
import type { AdoptedProbes } from '../../override/adopted-probes.js';
import type { AdoptionToken } from '../../../adoption/adoption-token.js';

const numberOfProcesses = config.get<number>('server.processes');
const asnCityPerUser = config.get<number>('probeLimit.asnCityPerUser');

const logger = scopedLogger('ws:limit');

const ipKeyCache = new LRUCache<string, string>({ max: 500_000 });

export const getIpKey = (ip: string): string => {
	const cached = ipKeyCache.get(ip);

	if (cached !== undefined) {
		return cached;
	}

	const parsed = ipaddr.parse(ip);
	let ipKey = ip;

	if (parsed.kind() === 'ipv6') {
		const ipv6 = parsed as ipaddr.IPv6;
		ipKey = ipv6.isIPv4MappedAddress()
			? ipv6.toIPv4Address().toString()
			: `${ipv6.parts.slice(0, 4).map(part => part.toString(16)).join(':')}::/64`;
	}

	ipKeyCache.set(ip, ipKey);

	return ipKey;
};

const asnCityKey = (userId: string, location: { asn: number; city: string }) => JSON.stringify([ userId, location.asn, location.city ]);

const addToSet = <K>(map: Map<K, Set<string>>, key: K, value: string) => {
	const set = map.get(key) ?? new Set<string>();
	set.add(value);
	map.set(key, set);
};

const lowestSocketId = (socketIds: string[]) => socketIds.reduce((min, id) => id < min ? id : min);

type UserProbe = Pick<ServerProbe, 'adoptionToken' | 'ipAddress' | 'uuid'> & { owner?: { id: string } };

export class ProbeIpLimit {
	private timer: NodeJS.Timeout | undefined;
	private ipKeyIndexPromise: Promise<Map<string, Set<string>>> | undefined;

	constructor (
		private readonly fetchProbes: IoContext['fetchProbes'],
		private readonly disconnectBySocketId: IoContext['disconnectBySocketId'],
		private readonly adoptedProbes: AdoptedProbes,
		private readonly adoptionToken: AdoptionToken,
	) {}

	scheduleSync () {
		clearTimeout(this.timer);

		this.timer = setTimeout(() => {
			this.syncIpLimit()
				.finally(() => this.scheduleSync())
				.catch(error => logger.error('Error in ProbeIpLimit.syncIpLimit()', error));
		}, 60_000 * 2 * Math.random() * numberOfProcesses).unref();
	}

	async syncIpLimit () {
		if (process.env['FAKE_PROBE_IP']) {
			return;
		}

		const probes = await this.fetchProbes();
		const { ipToClients, primaryIpToClients, rangeToClients, primaryRangeToClients } = this.indexIpsForSync(probes);
		const asnCityToIpKeys = this.indexAsnCity(probes);
		const socketIdsToDisconnect = new Set<string>();

		// Exact IP duplicates: keep one, preferring an alt-IP holder over the primary-IP holder.
		for (const [ ip, clients ] of ipToClients) {
			if (clients.size <= 1) {
				continue;
			}

			const alts = [ ...clients ].filter(socketId => !primaryIpToClients.get(ip)?.has(socketId));
			const survivor = lowestSocketId(alts.length > 0 ? alts : [ ...clients ]);

			for (const socketId of clients) {
				if (socketId !== survivor) {
					socketIdsToDisconnect.add(socketId);
				}
			}
		}

		// /64 range duplicates: a primary IP must be alone in its range; alt IPs may share a range with each other.
		for (const [ ipKey, clients ] of rangeToClients) {
			if (!ipKey.endsWith('/64')) {
				continue;
			}

			const live = [ ...clients ].filter(socketId => !socketIdsToDisconnect.has(socketId));
			const primaries = live.filter(socketId => primaryRangeToClients.get(ipKey)?.has(socketId));

			if (live.length <= 1 || primaries.length === 0) {
				continue;
			}

			// If there is at least one alt IP => disconnect all primaries, if all are primaries => keep one primary.
			const primarySurvivor = live.length > primaries.length ? null : lowestSocketId(primaries);

			for (const socketId of primaries) {
				if (socketId !== primarySurvivor) {
					socketIdsToDisconnect.add(socketId);
				}
			}
		}

		// ASN duplicates: Allowing only `asnCityPerUser` number of ipKeys per user+asn+city.
		for (const ipKeyClients of asnCityToIpKeys.values()) {
			const clientsGroups = [ ...ipKeyClients.values() ]
				.map(clients => [ ...clients ].filter(socketId => !socketIdsToDisconnect.has(socketId)))
				.filter(clients => clients.length > 0);

			if (clientsGroups.length <= asnCityPerUser) {
				continue;
			}

			clientsGroups
				.sort((a, b) => lowestSocketId(a) < lowestSocketId(b) ? -1 : 1)
				.slice(asnCityPerUser)
				.forEach(clients => clients.forEach(socketId => socketIdsToDisconnect.add(socketId)));
		}

		socketIdsToDisconnect.forEach(socketId => this.disconnectBySocketId(socketId));
	}

	async verifyIpLimit (ipAddress: string, socketId: string): Promise<void> {
		if (process.env['FAKE_PROBE_IP'] || process.env['TEST_MODE'] === 'unit') {
			return;
		}

		const ipKeyToClients = await this.buildIpKeyIndex();
		const clients = ipKeyToClients.get(getIpKey(ipAddress));

		if (clients && (clients.size > 1 || !clients.has(socketId))) {
			logger.warn(`WS client ${socketId} has reached the concurrent IP limit.`, { message: ipAddress });
			throw new ProbeError('ip limit');
		}
	}

	async verifyAsnLimit (probe: SocketProbe): Promise<void> {
		if (process.env['FAKE_PROBE_IP'] || process.env['TEST_MODE'] === 'unit') {
			return;
		}

		const userId = this.getUserId(probe);

		if (!userId) {
			return;
		}

		// Cached list is fine here: verifyIpLimit already refreshed it via allowStale: false.
		const probes = await this.fetchProbes();
		const ipKeys = new Set<string>();

		for (const other of probes) {
			if (other.location.asn !== probe.location.asn
				|| other.location.city !== probe.location.city
				|| other.client === probe.client
				|| this.getUserId(other) !== userId) {
				continue;
			}

			ipKeys.add(getIpKey(other.ipAddress));

			if (ipKeys.size >= asnCityPerUser) {
				logger.warn(`WS client ${probe.client} has reached the asn limit.`, { userId, ip: probe.ipAddress, ipKeys: [ ...ipKeys ], asn: probe.location.asn, city: probe.location.city });
				throw new ProbeError('asn limit');
			}
		}
	}

	private buildIpKeyIndex (): Promise<Map<string, Set<string>>> {
		// If same promise is already in-flight - return it.
		if (this.ipKeyIndexPromise) {
			return this.ipKeyIndexPromise;
		}

		this.ipKeyIndexPromise = (async () => {
			try {
				return this.indexIpKeys(await this.fetchProbes({ allowStale: false }));
			} finally {
				this.ipKeyIndexPromise = undefined;
			}
		})();

		return this.ipKeyIndexPromise;
	}

	private indexIpKeys (probes: ServerProbe[]): Map<string, Set<string>> {
		const ipKeyToClients = new Map<string, Set<string>>();

		for (const probe of probes) {
			for (const ip of [ probe.ipAddress, ...probe.altIpAddresses ]) {
				addToSet(ipKeyToClients, getIpKey(ip), probe.client);
			}
		}

		return ipKeyToClients;
	}

	// Indexes the list by exact IP and by /64 range, tracking which clients hold each as their primary IP.
	private indexIpsForSync (probes: ServerProbe[]) {
		const ipToClients = new Map<string, Set<string>>();
		const primaryIpToClients = new Map<string, Set<string>>();
		const rangeToClients = new Map<string, Set<string>>();
		const primaryRangeToClients = new Map<string, Set<string>>();

		for (const probe of probes) {
			const primaryIpKey = getIpKey(probe.ipAddress);
			addToSet(ipToClients, probe.ipAddress, probe.client);
			addToSet(primaryIpToClients, probe.ipAddress, probe.client);
			addToSet(rangeToClients, primaryIpKey, probe.client);
			addToSet(primaryRangeToClients, primaryIpKey, probe.client);

			for (const altIp of probe.altIpAddresses) {
				addToSet(ipToClients, altIp, probe.client);
				addToSet(rangeToClients, getIpKey(altIp), probe.client);
			}
		}

		return { ipToClients, primaryIpToClients, rangeToClients, primaryRangeToClients };
	}

	// Keeping user+asn+city uniqueness by ipKey, not by client, to handle reconnecting probes.
	private indexAsnCity (probes: ServerProbe[]): Map<string, Map<string, Set<string>>> {
		const asnCityToIpKeys = new Map<string, Map<string, Set<string>>>();

		for (const probe of probes) {
			const userId = this.getUserId(probe);

			if (!userId) {
				continue;
			}

			const key = asnCityKey(userId, probe.location);
			const ipKeyClients = asnCityToIpKeys.get(key) ?? new Map<string, Set<string>>();
			asnCityToIpKeys.set(key, ipKeyClients);
			addToSet(ipKeyClients, getIpKey(probe.ipAddress), probe.client);
		}

		return asnCityToIpKeys;
	}

	private getUserId (probe: UserProbe): string | null {
		if (probe.owner?.id) {
			return probe.owner.id;
		}

		const userId = probe.adoptionToken && this.adoptionToken.getUserIdByToken(probe.adoptionToken);

		if (userId) {
			return userId;
		}

		// Connecting SocketProbe doesn't have `owner.id` yet, so we are searching for user by IP / UUID.
		const dProbe = this.adoptedProbes.getByIp(probe.ipAddress) || this.adoptedProbes.getByUuid(probe.uuid);
		return dProbe?.userId ?? null;
	}
}
