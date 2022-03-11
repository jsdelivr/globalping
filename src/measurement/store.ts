import cryptoRandomString from 'crypto-random-string';
import type {Probe} from '../probe/store.js';
import type {RedisClient} from '../lib/redis/client.js';
import {getRedisClient} from '../lib/redis/client.js';
import type {MeasurementRecord, MeasurementResultMessage, NetworkTest} from './types.js';

export const getMeasurementKey = (id: string, suffix: 'probes_awaiting' | undefined = undefined): string => {
	let key = `gp:measurement:${id}`;

	if (suffix) {
		key += `:${suffix}`;
	}

	return key;
};

export class MeasurementStore {
	constructor(private readonly redis: RedisClient) {}

	async getMeasurementResults(id: string): Promise<MeasurementRecord> {
		return await this.redis.json.get(`gp:measurement:${id}`) as never;
	}

	async createMeasurement(test: NetworkTest, probesCount: number): Promise<string> {
		const id = cryptoRandomString({length: 16, type: 'alphanumeric'});
		const key = getMeasurementKey(id);

		await this.redis.executeIsolated(async client => {
			await client.set(getMeasurementKey(id, 'probes_awaiting'), probesCount, {EX: 300});
			await client.json.set(key, '$', {
				id,
				type: test.type,
				status: 'in-progress',
				createdAt: Date.now(),
				updatedAt: Date.now(),
				results: {},
			});
		});

		return id;
	}

	async storeMeasurementProbe(measurementId: string, probeId: string, probe: Probe): Promise<void> {
		const key = getMeasurementKey(measurementId);
		await this.redis.executeIsolated(async client => {
			await client.json.set(key, `$.results.${probeId}`, {
				probe: {
					continent: probe.continent,
					country: probe.country,
					city: probe.city,
					asn: probe.asn,
				},
				result: {},
			});
			await client.json.set(key, '$.updatedAt', Date.now());
		});
	}

	async storeMeasurementProgress(data: MeasurementResultMessage): Promise<void> {
		const key = getMeasurementKey(data.measurementId);

		await this.redis.executeIsolated(async client => {
			await client.json.set(key, `$.results.${data.testId}.result`, data.result);
			await client.json.set(key, '$.updatedAt', Date.now());
		});
	}

	async storeMeasurementResult(data: MeasurementResultMessage): Promise<void> {
		const key = getMeasurementKey(data.measurementId);

		await this.redis.executeIsolated(async client => {
			await client.json.set(key, `$.results.${data.testId}.result`, data.result);
			await client.json.set(key, '$.updatedAt', Date.now());
			await client.decr(`${key}:probes_awaiting`);
		});
	}

	async markFinished(id: string): Promise<void> {
		const key = getMeasurementKey(id);

		await this.redis.executeIsolated(async client => {
			await client.json.set(key, '$.status', 'finished');
			await client.json.set(key, '$.updatedAt', Date.now());
		});
	}
}

let store: MeasurementStore;

export const getMeasurementStore = () => {
	if (!store) {
		store = new MeasurementStore(getRedisClient());
	}

	return store;
};
