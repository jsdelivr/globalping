import type {RedisClient} from '../lib/redis/client.js';
import type {Locations} from '../measurement/locations.js';

export type Probe = {
	client: string;
	ipAddress: string;
	city: number;
	country: string;
	region: string;
	continent: string;
	asn: number;
};

export const PROBE_STORE_PREFIX = 'gp:probes';
export const PROBE_STORE_IDX_KEY = 'gp:idx:probes';

export class ProbeStore {
	private readonly ttl = 7; // Seconds

	constructor(private readonly redis: RedisClient) {}

	public async add(probe: Probe): Promise<void> {
		const key = this.buildKey(probe.client);

		// Todo: handle error
		await this.redis
			.multi()
			.hSet(key, probe)
			.expire(key, this.ttl)
			.exec();
	}

	public async getAll(): Promise<Probe[]> {
		const multi = this.redis.multi();

		for await (const key of this.redis.scanIterator({COUNT: 100, MATCH: 'gp:probes:*'})) {
			multi.hGetAll(key);
		}

		const probes = await multi.exec() as never;

		return probes as Probe[];
	}

	public async getByLocations(locations: Locations[]): Promise<Probe[]> {
		const filters = [];

		for (const location of locations) {
			filters.push(`(@${location.type}:{${location.value.join(' | ')}})`);
		}

		const result = await this.redis.ft.search(PROBE_STORE_IDX_KEY, filters.join(' | '), {
			LIMIT: {from: 0, size: 1e6},
		});

		// Return this.redis.sendCommand<Probe[]>(['FT.SEARCH', 'probes', locationFilter, 'LIMIT', '0', '1000000']);

		return result.documents.map(d => d.value) as Probe[];
	}

	public async delete(probe: Probe): Promise<void> {
		await this.redis.del(this.buildKey(probe.client));
	}

	public async markAlive(clientId: string): Promise<void> {
		const key = this.buildKey(clientId);

		await this.redis.expire(key, this.ttl);
	}

	private buildKey(clientId: string): string {
		return `${PROBE_STORE_PREFIX}:${clientId}`;
	}
}
