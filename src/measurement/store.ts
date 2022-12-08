import config from 'config';
import cryptoRandomString from 'crypto-random-string';
import type {Probe} from '../probe/types.js';
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
		return await this.redis.json.get(getMeasurementKey(id)) as never;
	}

	async createMeasurement(test: NetworkTest, probesCount: number): Promise<string> {
		const id = cryptoRandomString({length: 16, type: 'alphanumeric'});
		const key = getMeasurementKey(id);

		const probesAwaitingTtl = config.get<number>('measurement.timeout') + 5;

		await Promise.all([
			// eslint-disable-next-line @typescript-eslint/naming-convention
			this.redis.set(getMeasurementKey(id, 'probes_awaiting'), probesCount, {EX: probesAwaitingTtl}),
			this.redis.json.set(key, '$', {
				id,
				type: test.type,
				status: 'in-progress',
				createdAt: Date.now(),
				updatedAt: Date.now(),
				probesCount,
				results: {},
			}),
			this.redis.expire(key, config.get<number>('measurement.resultTTL')),
		]);

		return id;
	}

	async storeMeasurementProbe(measurementId: string, probeId: string, probe: Probe): Promise<void> {
		const key = getMeasurementKey(measurementId);
		await Promise.all([
			this.redis.json.set(key, `$.results.${probeId}`, {
				probe: {
					continent: probe.location.continent,
					region: probe.location.region,
					country: probe.location.country,
					state: probe.location.state ?? null,
					city: probe.location.city,
					asn: probe.location.asn,
					longitude: probe.location.longitude,
					latitude: probe.location.latitude,
					network: probe.location.network,
					tags: probe.tags.map(({value}) => value),
					resolvers: probe.resolvers,
				},
				result: {rawOutput: ''},
			}),
			this.redis.json.set(key, '$.updatedAt', Date.now()),
		]);
	}

	async storeMeasurementProgress(data: MeasurementResultMessage): Promise<void> {
		const key = getMeasurementKey(data.measurementId);

		await Promise.all([
			data.overwrite
				? this.redis.json.set(key, `$.results.${data.testId}.result.rawOutput`, data.result.rawOutput)
				: this.redis.json.strAppend(key, `$.results.${data.testId}.result.rawOutput`, data.result.rawOutput),

			this.redis.json.set(key, '$.updatedAt', Date.now()),
		]);
	}

	async storeMeasurementResult(data: MeasurementResultMessage): Promise<void> {
		const key = getMeasurementKey(data.measurementId);

		await Promise.all([
			this.redis.json.set(key, `$.results.${data.testId}.result`, data.result),
			this.redis.json.set(key, '$.updatedAt', Date.now()),
			this.redis.decr(`${key}:probes_awaiting`),
		]);
	}

	async markFinished(id: string): Promise<void> {
		const key = getMeasurementKey(id);

		await Promise.all([
			this.redis.json.set(key, '$.status', 'finished'),
			this.redis.json.set(key, '$.updatedAt', Date.now()),
		]);
	}
}

let store: MeasurementStore;

export const getMeasurementStore = () => {
	if (!store) {
		store = new MeasurementStore(getRedisClient());
	}

	return store;
};
